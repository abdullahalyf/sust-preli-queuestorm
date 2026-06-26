/**
 * Dictionaries for the Complaint Analysis Engine.
 *
 * Centralized so the normalizer + parser can share a single source of truth.
 * Pure data — no logic.
 */

// --- Money words (English) ---
const MONEY_WORDS = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lac: 100000,
  million: 1000000,
  crore: 10000000,
};

const UNIT_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS_WORDS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// --- Bangla digit map ---
const BANGLA_DIGITS = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

// --- Banglish → English (lowercase, normalized key) ---
const BANGLISH_MAP = {
  aj: 'today',
  ajke: 'today',
  aaj: 'today',
  aajke: 'today',
  kal: 'yesterday',
  kalr: 'yesterday',
  gotokal: 'day before yesterday',
  parso: 'day after tomorrow',
  sokale: 'this morning',
  bikale: 'this afternoon',
  rate: 'at night',
  raat: 'at night',
  sokaler: 'this morning',
  bikal: 'this afternoon',
  hoyeche: 'happened',
  hoyese: 'happened',
  na: 'did not',
  nai: 'did not',

  taka: 'taka',
  tk: 'taka',
  tkah: 'taka',
  poisa: 'poisha',

  bkash: 'bkash',
  nagad: 'nagad',
  rocket: 'rocket',
  upay: 'upay',
  ucash: 'ucash',

  poisa: 'poisha',
  taka: 'taka',

  tular: 'transfer',
  tulon: 'transfer',

  pathano: 'send',
  pathaise: 'sent',
  pathiye: 'sent',

  pawar: 'receive',
  pelam: 'received',
  paislo: 'received',
  paoa: 'receive',

  bechor: 'fraud',
  dhokha: 'fraud',
  chori: 'stolen',

  card: 'card',
  pin: 'pin',
  otp: 'otp',
  password: 'password',
};

// --- Bengali → English transliteration map (best-effort) ---
const BANGLA_TO_ENGLISH = {
  আজ: 'today',
  আজকে: 'today',
  কাল: 'yesterday',
  গতকাল: 'day before yesterday',
  পরশু: 'day after tomorrow',
  সকাল: 'morning',
  বিকাল: 'afternoon',
  রাত: 'night',
  'আজ রাতে': 'last night',
  'গত রাতে': 'last night',

  টাকা: 'taka',
  পয়সা: 'poisha',
  হাজার: 'thousand',
  লাখ: 'lakh',
  কোটি: 'crore',

  বিকাশ: 'bkash',
  নগদ: 'nagad',
  রকেট: 'rocket',
  উপায়: 'upay',

  পাঠানো: 'send',
  পাঠিয়েছি: 'sent',
  পাঠাই: 'sent',
  পাঠাওয়া: 'sent',
  পাঠাতে: 'to send',
  পাঠাই: 'sent',

  পেয়েছি: 'received',
  পেলাম: 'received',
  পাওয়া: 'receive',
  পাইনি: 'did not receive',
  পাই: 'receive',

  কেটে: 'deducted',
  'কেটে নিয়েছে': 'deducted',
  'কেটে নেয়নি': 'did not deduct',

  কিন্তু: 'but',

  প্রতারণা: 'fraud',
  জালিয়াতি: 'fraud',
  চুরি: 'stolen',

  অ্যাকাউন্ট: 'account',
  অ্যাকাউন্টে: 'account',
  হ্যাক: 'hack',

  কার্ড: 'card',
  পিন: 'pin',
  পাসওয়ার্ড: 'password',
  ওটিপি: 'otp',
};

// --- Transaction terminology normalization ---
const TRANSACTION_TERMS = {
  send_money: ['send money', 'sent money', 'transfer money', 'send', 'sent', 'transfer',
               'পাঠানো', 'পাঠিয়েছি', 'পাঠাওয়া', 'tular', 'pathano', 'pathaise', 'pathiye'],
  receive_money: ['receive money', 'received money', 'receive', 'received', 'got money',
                  'পেয়েছি', 'পেলাম', 'পাওয়া', 'paislo', 'pelam', 'pawar', 'paoa'],
  cash_out: ['cashout', 'cash out', 'withdraw', 'withdrawal', 'cash withdrawal',
             'টাকা তোলা', 'ক্যাশ আউট'],
  cash_in: ['cashin', 'cash in', 'deposit', 'add money',
            'টাকা জমা', 'ক্যাশ ইন'],
  payment: ['payment', 'pay', 'paid', 'bill pay', 'bill payment',
            'পেমেন্ট', 'বিল পেমেন্ট'],
  mobile_recharge: ['recharge', 'mobile recharge', 'topup', 'top up', 'top-up',
                    'রিচার্জ', 'টপআপ'],
  balance_check: ['balance', 'check balance', 'balance check',
                  'ব্যালেন্স'],
};

// --- Status keywords ---
// NOTE: keep these to UNAMBIGUOUS status words. "sent" / "received" overlap with
// the transaction-type verbs in TRANSACTION_TERMS and are intentionally excluded
// here so a complaint like "I sent money" doesn't get tagged status=success.
const STATUS_TERMS = {
  success: ['successful', 'success', 'completed', 'done', 'paid',
            'সফল', 'সম্পন্ন', 'সম্পন্ন হয়েছে'],
  failed: ['failed', 'failure', 'unsuccessful', 'did not go', 'didnt go',
           'not received', 'not sent', 'deducted but not received',
           'ব্যর্থ', 'হয়নি', 'ব্যর্থ হয়েছে'],
  pending: ['pending', 'processing', 'in progress', 'waiting',
            'অপেক্ষমাণ', 'প্রক্রিয়াধীন'],
  reversed: ['reversed', 'refunded', 'returned', 'canceled', 'cancelled',
             'ফেরত', 'রিফান্ড', 'বাতিল'],
};

// --- Intent keywords ---
// Each intent owns a list of trigger phrases in English / Banglish / Bangla.
// Phrases may contain spaces; matching is case-insensitive substring after
// normalization. The parser is responsible for tie-breaking and confidence.
const INTENT_TERMS = {
  wrong_transfer: [
    'wrong number', 'wrong person', 'sent to wrong', 'wrong account',
    'mistakenly sent', 'accidentally sent', 'by mistake',
    'ভুল নাম্বারে', 'ভুল নম্বরে', 'ভুল অ্যাকাউন্টে', 'ভুল করে পাঠিয়েছি',
    'ভুল করে', 'ভুল ব্যক্তি', 'ভুল মানুষ',
    'bhul number', 'bhul numbere', 'bhul account', 'vul number', 'vul numbere',
    'vul account', 'vul kore pathaisi', 'vul kore pathiye', 'bhul kore pathaisi',
  ],
  failed_payment: [
    'failed', 'did not go', 'didnt go', "didn't go", 'transaction failed',
    'payment failed', 'not sent', 'could not send', "couldn't send",
    'money deducted', 'deducted but not received', 'deducted but not sent',
    'টাকা কেটে গেছে', 'টাকা কেটে গেছে কিন্তু', 'কেটে গেছে', 'কেটে নিয়েছে কিন্তু পাইনি',
    'কাটা হয়েছে কিন্তু পাইনি', 'পাঠানো হয়নি', 'লেনদেন ব্যর্থ', 'পেমেন্ট ব্যর্থ',
    'taka kete gese', 'taka kete niyechhe', 'pathano hoyni', 'pathano hoy nai',
    'transaction fail', 'payment fail', 'taka kete', 'kete gese', 'kete niyechhe',
  ],
  money_not_received: [
    'did not receive', 'didnt receive', "didn't receive", 'not received', 'not get',
    'did not get', 'didnt get', "didn't get", 'have not received', 'havent received',
    "haven't received", 'sender did not receive', 'i did not receive',
    'i didnt receive', 'i didn t receive',
    'paisi na', 'pailam na', 'pelam na', 'pai ni', 'pailani', 'paisini',
    'পাইনি', 'পাইলাম না', 'পাই নাই', 'পেলাম না', 'হাতে পাইনি', 'পেয়েছি না',
    'পাই নাই', 'পাই নি',
    'paislo na', 'paisilam na', 'paisi na', 'paisilam na', 'jomi pailam na',
    'taka pai ni', 'taka pai nai', 'taka pai ni',
  ],
  unauthorized_transaction: [
    'someone used my account', 'someone used my card', 'unauthorized transaction',
    'unauthorized', 'unauthorised', 'without my consent', 'did not do this transaction',
    'not my transaction', 'stole from my account', 'account hacked', 'account compromised',
    'আমার অ্যাকাউন্ট ব্যবহার করেছে', 'আমার অ্যাকাউন্ট থেকে', 'অনুমতি ছাড়া',
    'আমি করিনি', 'আমি করি নাই', 'অননুমোদিত',
    'amar account theke', 'amar account bebohar', 'amari kori ni', 'amari kori nai',
  ],
  refund_request: [
    'refund', 'refund please', 'want refund', 'need refund', 'return money',
    'give my money back', 'please refund', 'refund my money',
    'ফেরত দিন', 'টাকা ফেরত', 'টাকা ফেরত চাই', 'ফেরত চাই', 'রিফান্ড',
    'taka ferot', 'taka ferot din', 'ferot din', 'ferot chai', 'refund kore din',
  ],
  cash_in_problem: [
    'cash in failed', 'cashin failed', 'cash-in failed', 'cannot cash in',
    "can't cash in", 'cant cash in', 'cash in not received', 'cashin problem',
    'cash in problem', 'cash-in problem', 'add money failed', 'top up failed',
    'topup failed', 'cash in', 'cashin', 'cash-in',
    'ক্যাশ ইন', 'ক্যাশ ইন ব্যর্থ', 'ক্যাশ ইন সমস্যা', 'টাকা ঢোকেনি', 'টাকা ঢুকেনি',
    'add money hoyni', 'topup hoyni', 'taka dhukeni', 'taka dhokeni',
    'cash in hoyni', 'cashin hoyni', 'cash in hoy nai', 'cashin hoy nai',
  ],
  cash_out_problem: [
    'cash out failed', 'cashout failed', 'cash-out failed', 'cannot cash out',
    "can't cash out", 'cant cash out', 'cash out problem', 'cashout problem',
    'cash-out problem', 'cash out not received', 'cashout not received',
    'withdraw failed', 'withdrawal failed', 'cannot withdraw', "can't withdraw",
    'cash out', 'cashout', 'cash-out',
    'ক্যাশ আউট ব্যর্থ', 'ক্যাশ আউট সমস্যা', 'উইথড্র ব্যর্থ', 'উইথড্র সমস্যা',
    'taka tulte parle na', 'cash out hoyni', 'cashout hoyni', 'withdraw hoyni',
    'taka tulteni', 'cash out hoy nai', 'cashout hoy nai',
  ],
  payment_reversal: [
    'reverse the payment', 'reverse payment', 'reverse the transaction',
    'reverse transaction', 'reverse my money', 'cancel the payment', 'cancel payment',
    'cancel transaction', 'reverse this transaction',
    'পেমেন্ট বাতিল', 'লেনদেন বাতিল', 'রিভার্স করুন', 'টাকা ফেরত নিন',
    'payment ulta', 'payment ultao', 'payment cancel', 'transaction cancel',
    'taka ultao', 'taka ulta', 'reverse kore din',
  ],
  account_access_issue: [
    'account blocked', 'account suspended', 'account frozen', 'account locked',
    'cannot login', "can't login", 'cant login', 'login problem', 'login failed',
    'cannot access my account', "can't access my account", 'password reset',
    'forgot password', 'forgot my password', 'account access',
    'অ্যাকাউন্ট ব্লক', 'অ্যাকাউন্ট স্থগিত', 'লগইন সমস্যা', 'লগইন ব্যর্থ',
    'পাসওয়ার্ড ভুলে গেছি', 'পাসওয়ার্ড ভুলে গেছেন',
    'account block hoyeche', 'login problem', 'login korte parchi na',
    'password bhule gechi', 'login hoy na',
  ],
  card_issue: [
    'card blocked', 'card block', 'card lost', 'lost card', 'card problem',
    'card not working', 'card damaged', 'card expired', 'card declined',
    'কার্ড ব্লক', 'কার্ড ব্লক হয়েছে', 'কার্ড হারিয়ে', 'কার্ড হারিয়ে গেছে', 'কার্ড সমস্যা',
    'card block hoyeche', 'card harie geche', 'card kaj korche na', 'card block kore',
  ],
  unknown: [],
};

// Confidence floor: a phrase shorter than this is too generic to claim an
// intent on its own (used by the parser to gate single-token hits).
const INTENT_MIN_PHRASE_LENGTH = 3;
// --- Counterparty keywords ---
const COUNTERPARTY_TERMS = [
  'merchant', 'seller', 'shop', 'shopkeeper', 'vendor', 'agent',
  'friend', 'family', 'relative', 'brother', 'sister', 'father', 'mother',
  'customer', 'number', 'account', 'user',
  'দোকানদার', 'বিক্রেতা', 'বন্ধু', 'পরিবার', 'ভাই', 'বোন', 'বাবা', 'মা',
  'মার্চেন্ট', 'এজেন্ট', 'নম্বর', 'অ্যাকাউন্ট',
];

// --- Security-sensitive keywords (mention only, not extraction) ---
const SECURITY_SENSITIVE_KEYWORDS = [
  'pin', 'otp', 'password', 'cvv', 'card number', 'card no',
  'account number', 'nid', 'national id',
  'পিন', 'ওটিপি', 'পাসওয়ার্ড', 'কার্ড নম্বর', 'এনআইডি',
];

// --- Fraud indicator keywords ---
const FRAUD_KEYWORDS = [
  'fraud', 'scam', 'hacked', 'stolen', 'cheated', 'phishing', 'fake',
  'unauthorized', 'suspicious', 'unknown transaction',
  'প্রতারণা', 'চুরি', 'হ্যাক', 'ঠকা', 'ফিশিং',
];

// --- Important keyword categories ---
// IMPORTANT: The Decision Engine's classifier looks for duplicate_payment
// signals inside `analysis.important_keywords`, so phrases like 'duplicate',
// 'twice', 'dobbar', etc. must appear in this section (not in FRAUD_KEYWORDS)
// to be picked up.
const IMPORTANT_KEYWORDS = {
  urgency: ['urgent', 'immediately', 'asap', 'right now', 'quickly',
            'জরুরি', 'এক্ষুনি', 'তাড়াতাড়ি'],
  money: ['taka', 'tk', 'money', 'cash', 'balance', 'amount',
          'টাকা', 'পয়সা', 'ব্যালেন্স'],
  platforms: ['bkash', 'nagad', 'rocket', 'upay', 'ucash',
              'বিকাশ', 'নগদ', 'রকেট', 'উপায়'],

  // Phrases that signal the customer was charged / paid more than once.
  // Each keyword must survive normalization intact — so we include both the
  // canonical English form and common Banglish / Bangla variants. The parser
  // also recognizes a few of these directly (e.g. 'twice', 'dobbar') but
  // putting them in IMPORTANT_KEYWORDS guarantees they reach the classifier.
  duplicate_payment: [
    // English
    'duplicate', 'twice', 'double charged', 'charged twice',
    'same payment', 'same transaction', 'double payment',
    'duplicate transaction', 'duplicate payment', 'duplicate charge',
    'deducted twice', 'two times', 'double',
    // Bangla (Bangla script gets transliterated to English by the normalizer;
    // the classifier matches on the English transliteration output).
    'dobbar', 'duibar', 'dui bar', 'double keteche', 'ekoi taka dui bar',
    'duibar payment',
    // Banglish (already Latin-script, survives normalization as-is).
    'double payment', 'duibar charge', 'same payment',
  ],

  // Phrases that signal a merchant-related settlement delay. The classifier
  // treats the co-occurrence of a merchant/payment counterparty + one of
  // these settlement hints as merchant_settlement_delay.
  merchant_settlement_delay: [
    // English
    'merchant settlement', 'merchant settlement delay',
    'merchant settlement pending', 'settlement pending',
    'merchant has not received settlement',
    'merchant payment pending',
    'merchant settlement delayed',
    'settlement not received',
    // Bangla transliterations
    'merchant settlement hoyni', 'merchant taka paini',
    'merchant payment hoyni',
    // Banglish
    'merchant settlement hoy nai', 'merchant payment pending',
    'settlement pai nai', 'merchant taka pai nai',
    'merchant payment hoy nai',
  ],

  // Phrases that the Decision Engine checks for merchant_settlement_delay
  // detection. Adding them here surfaces them in `important_keywords` so the
  // classifier's co-occurrence rule can fire without modifying the engine.
  product_fulfilment: [
    'product', 'goods', 'service', 'order', 'delivery', 'not received',
    'পণ্য', 'সেবা', 'অর্ডার', 'ডেলিভারি',
  ],
};

module.exports = {
  MONEY_WORDS,
  UNIT_WORDS,
  TENS_WORDS,
  BANGLA_DIGITS,
  BANGLISH_MAP,
  BANGLA_TO_ENGLISH,
  TRANSACTION_TERMS,
  STATUS_TERMS,
  INTENT_TERMS,
  COUNTERPARTY_TERMS,
  SECURITY_SENSITIVE_KEYWORDS,
  FRAUD_KEYWORDS,
  IMPORTANT_KEYWORDS,
  INTENT_MIN_PHRASE_LENGTH,
};