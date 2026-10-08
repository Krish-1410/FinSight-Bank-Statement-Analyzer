export interface CategoryRule {
  category: string;
  keywords: string[];
}

export const CATEGORIES = [
  'Housing',
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Subscriptions',
  'Travel',
  'Education',
  'Income',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Income',
    keywords: [
      'payroll', 'direct dep', 'direct deposit', 'salary', 'wages', 'transfer in',
      'wire in', 'dividend', 'interest payment', 'refund', 'reimbursement', 'tax refund',
      'irs treas', 'zelle from', 'venmo from', 'cash app from', 'bonus', 'stipend'
    ],
  },
  {
    category: 'Housing',
    keywords: [
      'rent', 'mortgage', 'lease', 'apartment', 'realty', 'property', 'landlord',
      'hoa fee', 'homeowners', 'escrow', 'zillow', 'greystar', 'avalon', 'equity residential'
    ],
  },
  {
    category: 'Food & Dining',
    keywords: [
      'restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'peets', 'mcdonald',
      'burger', 'chipotle', 'taco', 'wendys', 'panera', 'subway', 'sweetgreen',
      'doordash', 'uber eats', 'grubhub', 'postmates', 'instacart',
      'trader joe', 'whole foods', 'safeway', 'kroger', 'costco', 'aldi', 'sprouts',
      'market', 'grocery', 'supermarket', 'bakery', 'pub', 'bar', 'diner', 'pizza', 'sushi'
    ],
  },
  {
    category: 'Transportation',
    keywords: [
      'uber', 'lyft', 'taxi', 'cab', 'transit', 'subway', 'metro', 'mta', 'bart',
      'train', 'amtrak', 'parking', 'parkmobile', 'spothero', 'toll', 'ezpass', 'fastrak',
      'gas', 'shell', 'chevron', 'bp gas', 'exxon', 'mobil', 'texaco', 'sunoco',
      'valero', 'speedway', 'wawa gas', 'quiktrip', 'circle k', 'auto repair', 'oil change'
    ],
  },
  {
    category: 'Utilities',
    keywords: [
      'electric', 'power', 'pge', 'edison', 'national grid', 'duke energy',
      'gas & electric', 'water utility', 'sewer', 'waste management', 'trash',
      'internet', 'broadband', 'comcast', 'xfinity', 'spectrum', 'charter',
      'at&t', 'verizon', 't-mobile', 'sprint', 'utility bill', 'coned', 'cable'
    ],
  },
  {
    category: 'Healthcare',
    keywords: [
      'pharmacy', 'cvs', 'walgreens', 'rite aid', 'prescription', 'hospital',
      'clinic', 'urgent care', 'doctor', 'physician', 'dental', 'dentist',
      'optometry', 'eyecare', 'lenscrafters', 'labcorp', 'quest diag', 'kaiser',
      'blue cross', 'aetna', 'cigna', 'united health', 'copay', 'medical'
    ],
  },
  {
    category: 'Subscriptions',
    keywords: [
      'netflix', 'spotify', 'apple music', 'disney+', 'disney plus', 'hulu', 'hbo',
      'max.com', 'youtube prem', 'amazon prime', 'patreon', 'substack',
      'gym', 'planet fitness', 'equinox', 'anytime fitness', 'la fitness', 'crunch',
      'crossfit', 'icloud', 'google one', 'google storage', 'dropbox', 'chatgpt',
      'openai', 'anthropic', 'github', 'adobe', 'canva', 'medium.com', 'new york times',
      'wsj', 'audible', 'peacock', 'paramount+'
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'cinema', 'theater', 'theatre', 'amc', 'regal', 'cinemark', 'ticketmaster',
      'stubhub', 'eventbrite', 'livenation', 'concert', 'bowling', 'golf',
      'steam games', 'playstation', 'psn', 'nintendo', 'xbox', 'epic games', 'twitch',
      'arcade', 'billiards', 'museum', 'zoo', 'aquarium'
    ],
  },
  {
    category: 'Travel',
    keywords: [
      'airline', 'airways', 'delta', 'united air', 'american air', 'southwest',
      'jetblue', 'alaska air', 'spirit air', 'hotel', 'marriott', 'hilton',
      'hyatt', 'sheraton', 'airbnb', 'vrbo', 'booking.com', 'expedia', 'kayak',
      'hertz', 'enterprise rent', 'avis', 'budget rent', 'tsa precheck', 'cruise'
    ],
  },
  {
    category: 'Education',
    keywords: [
      'tuition', 'university', 'college', 'school', 'academy', 'campus',
      'coursera', 'udemy', 'edx', 'masterclass', 'skillshare', 'bookstore',
      'chegg', 'textbook', 'student loan', 'fafsa', 'training course'
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'walmart', 'target', 'ebay', 'best buy', 'apple store',
      'home depot', 'lowes', 'ikea', 'wayfair', 'zara', 'h&m', 'nike',
      'adidas', 'lululemon', 'nordstrom', 'macys', 'tj maxx', 'marshalls',
      'sephora', 'ulta', 'etsy', 'gap', 'old navy', 'clothing', 'hardware'
    ],
  },
];

/**
 * Extracts a clean merchant name from raw bank description
 */
export function extractMerchant(rawDescription: string): string {
  if (!rawDescription) return 'Unknown Merchant';

  let cleaned = rawDescription
    .replace(/(POS|DEBIT|CREDIT|PURCHASE|CHECKCARD|CARD PURCHASE|ONLINE PMT|ELECTRONIC PMT|ACH WITHDRAWAL|PAYMENT TO|BILL PAY|RECURRING PMT|DIRECT DEBIT)\s*[-:]?\s*/gi, '')
    .replace(/#\d+/g, '')
    .replace(/\b\d{4,}\b/g, '') // remove account/terminal numbers
    .replace(/\b(LLC|INC|CORP|CO|LTD)\b/gi, '')
    .replace(/[\*\#\_\-\:\/]+/g, ' ')
    .replace(/\s+[A-Z]{2}\s*$/, '') // remove state code like CA, NY at end
    .trim();

  // Common normalization mapping
  const lower = cleaned.toLowerCase();
  if (lower.includes('amazon') || lower.includes('amzn')) return 'Amazon';
  if (lower.includes('starbucks')) return 'Starbucks';
  if (lower.includes('netflix')) return 'Netflix';
  if (lower.includes('spotify')) return 'Spotify';
  if (lower.includes('uber eats')) return 'Uber Eats';
  if (lower.includes('uber') && !lower.includes('eats')) return 'Uber';
  if (lower.includes('lyft')) return 'Lyft';
  if (lower.includes('doordash')) return 'DoorDash';
  if (lower.includes('whole foods') || lower.includes('wholefds')) return 'Whole Foods';
  if (lower.includes('trader joe')) return 'Trader Joe\'s';
  if (lower.includes('walmart') || lower.includes('wal-mart')) return 'Walmart';
  if (lower.includes('target')) return 'Target';
  if (lower.includes('chevron')) return 'Chevron';
  if (lower.includes('shell')) return 'Shell';
  if (lower.includes('apple')) return 'Apple';
  if (lower.includes('cvs')) return 'CVS Pharmacy';
  if (lower.includes('walgreens')) return 'Walgreens';
  if (lower.includes('costco')) return 'Costco';
  if (lower.includes('equinox')) return 'Equinox Fitness';
  if (lower.includes('chatgpt') || lower.includes('openai')) return 'OpenAI ChatGPT';
  if (lower.includes('direct deposit') || lower.includes('payroll')) return 'Payroll Direct Deposit';

  // Capitalize words nicely
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30).trim();
  }

  return cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'Merchant';
}

/**
 * Categorizes a transaction based on description, merchant, and transaction type.
 */
export function categorizeTransaction(
  description: string,
  merchant: string,
  type: 'expense' | 'income'
): Category {
  if (type === 'income') {
    return 'Income';
  }

  const text = `${description} ${merchant}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.category === 'Income') {
      continue;
    }
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return rule.category as Category;
      }
    }
  }

  return 'Other';
}
