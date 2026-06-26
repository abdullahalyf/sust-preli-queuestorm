/**
 * Parser — extracts structured fields from a normalized complaint.
 *
 * Input  : normalized string (lowercase, single-spaced, multilingual surface forms)
 * Output : structured object — see `emptyResult()` for shape.
 *
 * This module ONLY extracts. It does NOT classify, route, or decide severity.
 */

const {
  MONEY_WORDS,
  UNIT_WORDS,
  TENS_WORDS,
  TRANSACTION_TERMS,
  STATUS_TERMS,
  INTENT_TERMS,
  COUNTERPARTY_TERMS,
  SECURITY_SENSITIVE_KEYWORDS,
  FRAUD_KEYWORDS,
  IMPORTANT_KEYWORDS,
  INTENT_MIN_PHRASE_LENGTH,
} = require('./dictionaries');

const emptyResult = () => ({
  intent: null,
  amount: null,
  transaction_type: null,
  transaction_status_if_mentioned: null,
  time_reference: null,
  counterparty_reference: null,
  refund_requested: false,
  fraud_indicators: [],
  security_sensitive_information_mentions: [],
  language: 'en',
  important_keywords: [],
});

// --- Language detection ---
const detectLanguage = (rawText, normalized) => {
  const hasBanglaScript = /[\u0980-\u09FF]/.test(rawText || '');
  if (hasBanglaScript) return 'bn';

  // Banglish heuristic: any Banglish token mapped by the normalizer.
  const tokens = normalized.split(' ');
  const banglishTokens = new Set([
    'aj', 'ajke', 'kal', 'gotokal', 'parso', 'sokale', 'bikale', 'rate', 'raat',
    'taka', 'tk', 'pathano', 'pathaise', 'pathiye', 'paislo', 'pelam',
  ]);
  if (tokens.some((t) => banglishTokens.has(t))) return 'banglish';

  return 'en';
};

// --- Amount extraction ---
const parseAmountFromDigits = (text) => {
  // Match forms: 5000, 5,000, 5.000, 5k, 5.5k
  // Prefer comma-grouped amounts (e.g., 1,000) when present.
  const grouped = text.match(/\b\d{1,3}(?:,\d{2,3})+\b/);
  if (grouped) {
    return parseInt(grouped[0].replace(/,/g, ''), 10);
  }

  const kMatch = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  const plain = text.match(/\b\d+\b/);
  if (plain) return parseInt(plain[0], 10);

  return null;
};

const parseAmountFromWords = (text) => {
  // Match patterns like "five thousand", "two lakh", "three thousand five hundred"
  const tokens = text.split(' ').filter(Boolean);
  let total = 0;
  let current = 0;
  let matched = false;

  for (const tok of tokens) {
    if (UNIT_WORDS[tok] !== undefined) {
      current += UNIT_WORDS[tok];
      matched = true;
    } else if (TENS_WORDS[tok] !== undefined) {
      current += TENS_WORDS[tok];
      matched = true;
    } else if (MONEY_WORDS[tok] !== undefined) {
      const multiplier = MONEY_WORDS[tok];
      if (current === 0) current = 1;
      current *= multiplier;
      total += current;
      current = 0;
      matched = true;
    } else {
      // reset on unknown token (small window)
      if (matched) break;
    }
  }
  total += current;
  return matched ? total : null;
};

const extractAmount = (normalized) => {
  // Try digit form first (more precise), fall back to words.
  const fromDigits = parseAmountFromDigits(normalized);
  if (fromDigits !== null) return fromDigits;
  return parseAmountFromWords(normalized);
};

// --- Time reference extraction ---
const TIME_MAP = {
  'today': 'today',
  'this morning': 'today_morning',
  'this afternoon': 'today_afternoon',
  'at night': 'tonight',
  'last night': 'last_night',
  'yesterday': 'yesterday',
  'day before yesterday': 'day_before_yesterday',
  'day after tomorrow': 'day_after_tomorrow',
};

const extractTimeReference = (normalized) => {
  for (const phrase of Object.keys(TIME_MAP).sort((a, b) => b.length - a.length)) {
    if (normalized.includes(phrase)) return TIME_MAP[phrase];
  }
  return null;
};

// --- Transaction type ---
const termHasBoundary = (haystack, term) => {
  if (term.includes(' ')) {
    // Multi-word term: substring match is safe (whitespace is the boundary).
    return haystack.includes(term);
  }
  // Single-word term: require word-boundary match to avoid "receive"
  // matching inside "received".
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return re.test(haystack);
};

const extractTransactionType = (normalized) => {
  // Order matters — more specific first.
  const orderedKeys = Object.keys(TRANSACTION_TERMS).sort(
    (a, b) => TRANSACTION_TERMS[b].length - TRANSACTION_TERMS[a].length
  );
  for (const key of orderedKeys) {
    const terms = TRANSACTION_TERMS[key];
    for (const term of terms) {
      if (termHasBoundary(normalized, term)) return key;
    }
  }
  return null;
};

// --- Transaction status ---
const extractTransactionStatus = (normalized) => {
  const orderedKeys = Object.keys(STATUS_TERMS).sort(
    (a, b) => STATUS_TERMS[b].length - STATUS_TERMS[a].length
  );
  for (const key of orderedKeys) {
    const terms = STATUS_TERMS[key];
    for (const term of terms) {
      if (termHasBoundary(normalized, term)) return key;
    }
  }
  return null;
};

// --- Intent ---
// Scoring rules:
//   - First match wins only among equally-strong phrases (longest phrase).
//   - Phrase length is the score (chars). Longer phrases = more specific.
//   - A match shorter than INTENT_MIN_PHRASE_LENGTH chars cannot single-handedly
//     claim an intent unless supported by another longer phrase in the same
//     intent (multi-word fallbacks keep `failed` / `refund` honest).
//   - On no match at all, returns 'unknown'.
const extractIntent = (normalized) => {
  const haystack = normalized || '';

  const candidates = []; // { intent, term, score }
  for (const intent of Object.keys(INTENT_TERMS)) {
    if (intent === 'unknown') continue;
    const terms = INTENT_TERMS[intent] || [];
    for (const term of terms) {
      if (!term) continue;
      const matched = term.includes(' ')
        ? haystack.includes(term)
        : termHasBoundary(haystack, term);
      if (matched) candidates.push({ intent, term, score: term.length });
    }
  }

  if (candidates.length === 0) return 'unknown';

  // Sort by score desc, then by intent name for determinism on ties.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.intent.localeCompare(b.intent);
  });

  const top = candidates[0];

  // Confidence gate: a single short token is too weak on its own.
  if (top.score < INTENT_MIN_PHRASE_LENGTH) {
    const sameIntentLonger = candidates.some(
      (c) => c.intent === top.intent && c.score >= INTENT_MIN_PHRASE_LENGTH
    );
    if (!sameIntentLonger) return 'unknown';
  }

  return top.intent;
};

// --- Refund requested ---
const REFUND_PHRASES = [
  'refund', 'want refund', 'need refund', 'return money', 'give my money back',
  'ফেরত', 'ফেরত দিন', 'টাকা ফেরত', 'ফেরত চাই',
];
const extractRefundRequested = (normalized) =>
  REFUND_PHRASES.some((p) => normalized.includes(p));

// --- Counterparty ---
const extractCounterparty = (normalized) => {
  for (const term of COUNTERPARTY_TERMS) {
    if (normalized.includes(term)) return term;
  }
  return null;
};

// --- Security sensitive mentions ---
const extractSecurityMentions = (normalized) => {
  const hits = [];
  for (const kw of SECURITY_SENSITIVE_KEYWORDS) {
    if (normalized.includes(kw)) hits.push(kw);
  }
  return Array.from(new Set(hits));
};

// --- Fraud indicators ---
const extractFraudIndicators = (normalized) => {
  const hits = [];
  for (const kw of FRAUD_KEYWORDS) {
    if (normalized.includes(kw)) hits.push(kw);
  }
  return Array.from(new Set(hits));
};

// --- Important keywords ---
const extractImportantKeywords = (normalized) => {
  const hits = new Set();
  for (const category of Object.keys(IMPORTANT_KEYWORDS)) {
    for (const kw of IMPORTANT_KEYWORDS[category]) {
      if (normalized.includes(kw)) hits.add(kw);
    }
  }
  return Array.from(hits);
};

const parse = (rawText, normalized) => {
  const result = emptyResult();

  result.language = detectLanguage(rawText, normalized);
  result.intent = extractIntent(normalized);
  result.amount = extractAmount(normalized);
  result.transaction_type = extractTransactionType(normalized);
  result.transaction_status_if_mentioned = extractTransactionStatus(normalized);
  result.time_reference = extractTimeReference(normalized);
  result.counterparty_reference = extractCounterparty(normalized);
  result.refund_requested = extractRefundRequested(normalized);
  result.fraud_indicators = extractFraudIndicators(normalized);
  result.security_sensitive_information_mentions = extractSecurityMentions(normalized);
  result.important_keywords = extractImportantKeywords(normalized);

  return result;
};

module.exports = {
  parse,
  // exported for unit testing
  _internals: {
    detectLanguage,
    extractAmount,
    extractTimeReference,
    extractTransactionType,
    extractTransactionStatus,
    extractIntent,
    extractRefundRequested,
    extractCounterparty,
    extractSecurityMentions,
    extractFraudIndicators,
    extractImportantKeywords,
  },
};