/**
 * Transaction Matcher — scoring primitives.
 *
 * Pure, deterministic functions only. No I/O, no clock reads (callers pass
 * `now` if they want time scoring).
 *
 * The total weighted score across all fields sums to at most
 * SCORE_MAX. A match is considered usable only when it reaches
 * CONFIDENCE_MIN_THRESHOLD, otherwise matcher.js returns null.
 */

// --- Weight configuration ---
// Tuned so that amount alone (strongest signal) can lift a candidate above
// the confidence floor, but real matches almost always combine amount +
// type + time. Adjust only with corresponding test coverage.
const WEIGHTS = Object.freeze({
  amount: 50,
  transactionType: 20,
  status: 15,
  time: 10,
  counterparty: 5,
  keywords: 10,
});

const SCORE_MAX =
  WEIGHTS.amount +
  WEIGHTS.transactionType +
  WEIGHTS.status +
  WEIGHTS.time +
  WEIGHTS.counterparty +
  WEIGHTS.keywords;

// Minimum confidence to declare a usable match. Tuned so an amount-only
// hit alone does not pass — at least one corroborating field is needed.
const CONFIDENCE_MIN_THRESHOLD = 35;

// Minimum margin the winner must hold over the runner-up to be trusted.
// Prevents picking a near-tied weaker candidate when scores cluster.
const CONFIDENCE_MIN_MARGIN = 5;

// --- Helpers ---
const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

const toNumber = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const toTimestamp = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

// --- Amount ---
// Exact match = full weight. Close match (within 5% or 50 BDT, whichever is
// greater) = 60% weight. Distant match = 0.
const scoreAmount = (complaintAmount, txAmount) => {
  const c = toNumber(complaintAmount);
  const t = toNumber(txAmount);
  if (c === null || t === null) return { score: 0, matched: false };
  if (c === t) return { score: WEIGHTS.amount, matched: true };

  const tolerance = Math.max(50, Math.abs(c) * 0.05);
  if (Math.abs(c - t) <= tolerance) {
    return { score: Math.round(WEIGHTS.amount * 0.6), matched: true };
  }
  return { score: 0, matched: false };
};

// --- Transaction type ---
const scoreType = (complaintType, txType) => {
  const c = norm(complaintType);
  const t = norm(txType);
  if (!c || !t) return { score: 0, matched: false };
  return c === t
    ? { score: WEIGHTS.transactionType, matched: true }
    : { score: 0, matched: false };
};

// --- Status ---
// A status mention in the complaint reinforces a matching tx.status.
// Mismatch penalizes is intentionally zero — we don't subtract, we just
// withhold credit (other modules may interpret negative signals).
const scoreStatus = (complaintStatus, txStatus) => {
  const c = norm(complaintStatus);
  const t = norm(txStatus);
  if (!c || !t) return { score: 0, matched: false };
  return c === t
    ? { score: WEIGHTS.status, matched: true }
    : { score: 0, matched: false };
};

// --- Time ---
// Bucketed proximity. Anchors are the analysis `time_reference` (e.g.
// 'yesterday') plus the transaction's timestamp. Caller passes `now` so
// the function stays pure.
//
// Buckets (hours from now):
//   < 6h, < 24h, < 72h, < 168h, >= 168h
const HOUR_MS = 60 * 60 * 1000;

const timeBucketHours = (deltaHours) => {
  if (deltaHours < 6) return 6;
  if (deltaHours < 24) return 24;
  if (deltaHours < 72) return 72;
  if (deltaHours < 168) return 168;
  return Infinity;
};

// Map complaint time_reference → allowed delta-hours window.
const TIME_WINDOWS = {
  today: [0, 24],
  today_morning: [0, 12],
  today_afternoon: [12, 18],
  tonight: [18, 30],
  last_night: [6, 18],
  yesterday: [18, 42],
  day_before_yesterday: [42, 72],
  day_after_tomorrow: [36, 72],
};

const scoreTime = (complaintTimeRef, txTimeValue, nowMs) => {
  const txTs = toTimestamp(txTimeValue);
  if (txTs === null) return { score: 0, matched: false };

  const ref = norm(complaintTimeRef);
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const deltaHours = Math.abs(now - txTs) / HOUR_MS;

  // No time reference in complaint → credit by recency alone.
  if (!ref) {
    if (deltaHours < 24) return { score: WEIGHTS.time, matched: true };
    if (deltaHours < 72) return { score: Math.round(WEIGHTS.time * 0.5), matched: true };
    return { score: 0, matched: false };
  }

  const window = TIME_WINDOWS[ref];
  if (!window) return { score: 0, matched: false };
  const [lo, hi] = window;
  if (deltaHours >= lo && deltaHours <= hi) {
    return { score: WEIGHTS.time, matched: true };
  }
  // Off by one bucket: half credit.
  const offByOne =
    (deltaHours < lo && deltaHours >= lo - 6) ||
    (deltaHours > hi && deltaHours <= hi + 12);
  if (offByOne) {
    return { score: Math.round(WEIGHTS.time * 0.5), matched: true };
  }
  return { score: 0, matched: false };
};

// --- Counterparty ---
// Strict string equality on normalized values. Counterparty references are
// noisy (people paraphrase phone numbers / merchant names), so weight is low
// but still useful as a tie-breaker.
const scoreCounterparty = (complaintRef, txCounterparty) => {
  const c = norm(complaintRef);
  const t = norm(txCounterparty);
  if (!c || !t) return { score: 0, matched: false };
  return c === t
    ? { score: WEIGHTS.counterparty, matched: true }
    : { score: 0, matched: false };
};

// --- Keyword similarity ---
// Token overlap between the complaint's important_keywords and a free-text
// tx.description / tx.notes field. Score = jaccard * weight.
const tokenize = (s) =>
  norm(s)
    .split(/[^a-zA-Z0-9\u0980-\u09FF]+/)
    .filter((t) => t.length >= 2);

const scoreKeywords = (complaintKeywords, txText) => {
  if (!Array.isArray(complaintKeywords) || complaintKeywords.length === 0) {
    return { score: 0, matched: false };
  }
  const haystack = tokenize(txText || '');
  if (haystack.length === 0) return { score: 0, matched: false };

  const haystackSet = new Set(haystack);
  const complaintTokens = complaintKeywords
    .map((k) => tokenize(k))
    .flat()
    .filter(Boolean);

  if (complaintTokens.length === 0) return { score: 0, matched: false };

  const intersection = complaintTokens.filter((t) => haystackSet.has(t));
  const unionSize = new Set([...haystackSet, ...complaintTokens]).size;
  if (unionSize === 0) return { score: 0, matched: false };

  const jaccard = intersection.length / unionSize;
  if (jaccard <= 0) return { score: 0, matched: false };

  return {
    score: Math.round(jaccard * WEIGHTS.keywords),
    matched: true,
  };
};

// Public helpers for matcher.js
module.exports = {
  WEIGHTS,
  SCORE_MAX,
  CONFIDENCE_MIN_THRESHOLD,
  CONFIDENCE_MIN_MARGIN,
  timeBucketHours,
  scoreAmount,
  scoreType,
  scoreStatus,
  scoreTime,
  scoreCounterparty,
  scoreKeywords,
  // re-exported for unit testing
  _internals: { norm, toNumber, toTimestamp, tokenize },
};