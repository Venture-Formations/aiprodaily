/**
 * Bot Detection Constants
 * Patterns and thresholds for detecting bot traffic in newsletter analytics
 */

/**
 * User-Agent patterns that indicate bot/automated traffic
 * Each pattern includes the match string and a human-readable reason
 */
export const BOT_UA_PATTERNS: Array<{ pattern: string; reason: string }> = [
  // Empty or missing UA
  { pattern: '', reason: 'Empty user agent' },

  // Generic bot/crawler identifiers
  { pattern: 'bot', reason: 'Contains "bot"' },
  { pattern: 'crawler', reason: 'Contains "crawler"' },
  { pattern: 'spider', reason: 'Contains "spider"' },
  { pattern: 'scraper', reason: 'Contains "scraper"' },
  { pattern: 'scanner', reason: 'Contains "scanner"' },

  // Email security scanners
  { pattern: 'barracuda', reason: 'Barracuda email scanner' },
  { pattern: 'mimecast', reason: 'Mimecast email scanner' },
  { pattern: 'proofpoint', reason: 'Proofpoint email scanner' },
  { pattern: 'fireeye', reason: 'FireEye email scanner' },
  { pattern: 'mailguard', reason: 'MailGuard scanner' },
  { pattern: 'messagelabs', reason: 'MessageLabs scanner' },
  { pattern: 'websense', reason: 'Websense scanner' },
  { pattern: 'forcepoint', reason: 'Forcepoint scanner' },
  { pattern: 'cloudmark', reason: 'Cloudmark scanner' },
  { pattern: 'spamhaus', reason: 'Spamhaus scanner' },

  // HTTP libraries (automated requests)
  { pattern: 'python-requests', reason: 'Python requests library' },
  { pattern: 'python-urllib', reason: 'Python urllib library' },
  { pattern: 'curl/', reason: 'cURL client' },
  { pattern: 'wget/', reason: 'Wget client' },
  { pattern: 'axios/', reason: 'Axios HTTP client' },
  { pattern: 'node-fetch', reason: 'Node fetch library' },
  { pattern: 'go-http-client', reason: 'Go HTTP client' },
  { pattern: 'java/', reason: 'Java HTTP client' },
  { pattern: 'libwww-perl', reason: 'Perl LWP library' },
  { pattern: 'httpclient', reason: 'HTTP client library' },

  // Headless browsers
  { pattern: 'headlesschrome', reason: 'Headless Chrome' },
  { pattern: 'phantomjs', reason: 'PhantomJS' },
  { pattern: 'selenium', reason: 'Selenium WebDriver' },
  { pattern: 'puppeteer', reason: 'Puppeteer' },
  { pattern: 'playwright', reason: 'Playwright' },

  // Search engine bots
  { pattern: 'googlebot', reason: 'Googlebot' },
  { pattern: 'bingbot', reason: 'Bingbot' },
  { pattern: 'yandexbot', reason: 'Yandex bot' },
  { pattern: 'baiduspider', reason: 'Baidu spider' },
  { pattern: 'duckduckbot', reason: 'DuckDuckGo bot' },
  { pattern: 'slurp', reason: 'Yahoo Slurp' },

  // Social media bots
  { pattern: 'facebookexternalhit', reason: 'Facebook crawler' },
  { pattern: 'twitterbot', reason: 'Twitter bot' },
  { pattern: 'linkedinbot', reason: 'LinkedIn bot' },
  { pattern: 'slackbot', reason: 'Slackbot' },
  { pattern: 'telegrambot', reason: 'Telegram bot' },
  { pattern: 'whatsapp', reason: 'WhatsApp preview' },

  // Other automated tools
  { pattern: 'ahrefsbot', reason: 'Ahrefs bot' },
  { pattern: 'semrushbot', reason: 'SEMrush bot' },
  { pattern: 'dotbot', reason: 'Moz bot' },
  { pattern: 'petalbot', reason: 'Petal bot' },
  { pattern: 'gptbot', reason: 'GPT bot' },
  { pattern: 'claudebot', reason: 'Claude bot' },
  { pattern: 'ccbot', reason: 'Common Crawl bot' }
]

/**
 * Velocity detection thresholds
 */
export const VELOCITY_THRESHOLD = {
  /** Number of distinct URLs that triggers velocity detection */
  MIN_CLICKS: 5,
  /** Time window in seconds to check for rapid clicks */
  TIME_WINDOW_SECONDS: 10
}

/**
 * Honeypot link configuration
 */
export const HONEYPOT_CONFIG = {
  /** Section name used for honeypot links */
  SECTION_NAME: 'Honeypot',
}
