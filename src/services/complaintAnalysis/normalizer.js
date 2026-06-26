/**
 * Normalizer — converts raw complaint text into a canonical lowercase,
 * single-spaced, multilingual representation. No semantic inference here.
 */

const {
  BANGLA_DIGITS,
  BANGLISH_MAP,
  BANGLA_TO_ENGLISH,
} = require('./dictionaries');

// Punctuation we want to preserve (amount-relevant: commas, decimals).
const PUNCT_KEEP = ',/.';

const normalizePunctuation = (text) =>
  text.replace(/[^\w\s\u0980-\u09FF,.+\-]/g, ' ');

const normalizeWhitespace = (text) =>
  text.replace(/\s+/g, ' ').trim();

const normalizeBanglaDigits = (text) =>
  text.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d]);

const transliterateBangla = (text) => {
  // Sort by descending key length so multi-word phrases like
  // "আজ সকালে" are matched before single-word keys like "আজ" or "সকাল".
  const keys = Object.keys(BANGLA_TO_ENGLISH).sort((a, b) => b.length - a.length);
  let out = text;
  for (const key of keys) {
    if (out.includes(key)) {
      out = out.split(key).join(' ' + BANGLA_TO_ENGLISH[key] + ' ');
    }
  }
  return out;
};

// Map multi-character Bangla inflection suffixes (ে, ি, া, etc.) to nothing
// so they don't leak into the normalized output as standalone garbage tokens.
const STRIP_BANGLA_INFLECTION = /[েিাুেোৌীূঃঁ]/g;
const stripBanglaInflection = (text) => text.replace(STRIP_BANGLA_INFLECTION, '');

const normalizeBanglish = (tokens) => {
  const out = [];
  for (const tok of tokens) {
    const key = tok.toLowerCase();
    if (BANGLISH_MAP[key]) {
      out.push(BANGLISH_MAP[key]);
    } else {
      out.push(tok);
    }
  }
  return out;
};

const normalizeTransactionTerminology = (text) => {
  // Canonicalize common variants into canonical form for downstream parsing.
  const replacements = [
    [/\bdo not\b/g, 'did not'],
    [/\bdont\b/g, 'did not'],
    [/\bcan not\b/g, 'cannot'],
    [/\bcant\b/g, 'cannot'],
    [/\bwon t\b/g, 'will not'],
    [/\bwont\b/g, 'will not'],
    [/\b\s+\b/g, ' '],
    [/\bcashout\b/g, 'cash out'],
    [/\bcashin\b/g, 'cash in'],
    [/\btopup\b/g, 'top up'],
    [/\btop-up\b/g, 'top up'],
  ];
  let out = text;
  for (const [pattern, repl] of replacements) {
    out = out.replace(pattern, repl);
  }
  return out;
};

// K / k suffix → thousand.
const normalizeAmountSuffixes = (text) =>
  text.replace(/(\d+(?:\.\d+)?)\s*k\b/gi, '$1k');

// "5,000" → keep as-is — comma-preserved form is handled by parser.

const toLower = (text) => text.toLowerCase();

// Relative-time normalization is done in the parser (it returns a structured
// time_reference). The normalizer just makes sure the surface forms survive
// consistently in lowercased text.

const normalize = (rawText) => {
  if (typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. trim and basic cleanup
  text = text.trim();

  // 2. transliterate Bangla script to English words
  text = transliterateBangla(text);

  // 2b. strip Bangla inflection suffixes left over from single-word keys
  text = stripBanglaInflection(text);

  // 3. Bangla digit → ASCII digit
  text = normalizeBanglaDigits(text);

  // 4. punctuation normalization
  text = normalizePunctuation(text);

  // 5. transaction terminology variants
  text = normalizeTransactionTerminology(text);

  // 6. amount suffixes (5k, 5 K)
  text = normalizeAmountSuffixes(text);

  // 7. lowercase
  text = toLower(text);

  // 8. final whitespace collapse
  text = normalizeWhitespace(text);

  // 9. Banglish token-level normalization (word-by-word)
  const tokens = text.split(' ').filter(Boolean);
  const normalizedTokens = normalizeBanglish(tokens);

  return normalizedTokens.join(' ');
};

module.exports = {
  normalize,
  // exported for unit testing
  _internals: {
    normalizePunctuation,
    normalizeWhitespace,
    normalizeBanglaDigits,
    transliterateBangla,
    normalizeBanglish,
    normalizeTransactionTerminology,
    normalizeAmountSuffixes,
  },
};