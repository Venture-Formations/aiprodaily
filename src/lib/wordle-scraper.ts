// Wordle web scraping utility for Tom's Guide archive
import * as cheerio from 'cheerio'

// Map calendar date to Wordle puzzle number
function getPuzzleNumber(targetDate: string): number {
  const start = new Date("2021-06-19") // NYT Wordle launch date (June 19, 2021)
  const target = new Date(targetDate)
  const days = Math.floor((target.getTime() - start.getTime()) / 86_400_000)
  return days // days_since_launch matches the displayed puzzle number
}

// Fetch Wordle answer by directly scraping Tom's Guide HTML
async function getWordleAnswer(dateStr: string): Promise<string | null> {
  try {
    const number = getPuzzleNumber(dateStr)
    console.log(`Looking for Wordle #${number} for date ${dateStr}`)

    // Fetch Tom's Guide page directly
    const url = 'https://www.tomsguide.com/news/what-is-todays-wordle-answer'
    console.log(`Fetching from: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch Tom's Guide: ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`Fetched HTML, length: ${html.length}`)

    // Look for answer directly in HTML (before cheerio parsing to preserve entities)
    // Pattern 1: JSON-escaped format "Drumroll, please \u2014 it's <strong>SPASM<\/strong>"
    let match = html.match(/Drumroll,?\s*please\s*\\u2014\s*it'?s\s*<strong>([A-Z]{5})<\\\/strong>/i)
    if (match) {
      const word = match[1].toUpperCase()
      console.log(`Found via Drumroll JSON pattern: ${word}`)
      return word
    }

    // Pattern 2: HTML entity format "Drumroll, please &mdash; it's <strong>SPASM</strong>"
    match = html.match(/Drumroll,?\s*please\s*&mdash;\s*it'?s\s*<strong>([A-Z]{5})<\/strong>/i)
    if (match) {
      const word = match[1].toUpperCase()
      console.log(`Found via Drumroll HTML pattern: ${word}`)
      return word
    }

    // Load HTML into cheerio for parsing (fallback methods)
    const $ = cheerio.load(html)
    const text = $('body').text()

    // Pattern 2: "Drumroll, please — it's SPASM" in plain text (with em dash)
    match = text.match(/Drumroll,?\s*please\s*[—–-]\s*it'?s\s+([A-Z]{5})/i)
    if (match) {
      const word = match[1].toUpperCase()
      console.log(`Found via Drumroll pattern: ${word}`)
      return word
    }

    // Pattern 3: "it's SPASM" (standalone)
    match = text.match(/it'?s\s+([A-Z]{5})[.\s]/i)
    if (match) {
      const word = match[1].toUpperCase()
      console.log(`Found via "it's" pattern: ${word}`)
      return word
    }

    // Pattern 3: "The answer is SPASM"
    match = text.match(/answer\s+is\s+([A-Z]{5})/i)
    if (match) {
      const word = match[1].toUpperCase()
      console.log(`Found via "answer is" pattern: ${word}`)
      return word
    }

    // Pattern 4: Look for puzzle number followed by answer
    const puzzlePattern = new RegExp(`#?${number}[\\s:,.-]+(?:is|answer)?\\s*([A-Z]{5})`, 'i')
    match = text.match(puzzlePattern)
    if (match) {
      const word = match[1].toUpperCase()
      console.log(`Found via puzzle # pattern: ${word}`)
      return word
    }

    console.log(`No Wordle answer found in Tom's Guide HTML for puzzle #${number}`)
    console.log('Text sample:', text.substring(0, 500))
    return null

  } catch (error) {
    console.error('Error scraping Tom\'s Guide:', error)
    return null
  }
}

// Get basic definition from a word (fallback dictionary lookup)
function getBasicDefinition(word: string): string {
  // Simple fallback definitions for common Wordle words
  const definitions: { [key: string]: string } = {
    'GOOEY': 'Soft and sticky',
    'BEACH': 'Sandy shore by the ocean',
    'STORM': 'Violent weather with strong winds and rain',
    'CLOUD': 'Visible mass of water vapor in the sky',
    'SPARK': 'Small fiery particle or bright flash',
    'GLINT': 'Brief flash or gleam of light'
  }

  return definitions[word] || `A five-letter word: ${word}`
}

// Get interesting fact about a word (simple fallback)
function getInterestingFact(word: string): string {
  const facts: { [key: string]: string } = {
    'GOOEY': 'The word gooey comes from the informal word goo, first recorded in the early 1900s',
    'BEACH': 'Beach comes from Old English bæce meaning stream or valley',
    'STORM': 'Storm derives from Old English meaning to rage or be in violent motion',
    'CLOUD': 'Cloud originally meant rock or hill in Old English before meaning sky formation',
    'SPARK': 'Spark dates back to Old English spearca meaning glowing particle',
    'GLINT': 'Glint originated in early 19th century from Scandinavian glinta meaning to shine'
  }

  return facts[word] || `The word ${word} has appeared in the New York Times Wordle puzzle`
}

// Main function to get complete Wordle data for a date
export async function getWordleDataForDate(dateStr: string): Promise<{
  word: string
  definition: string
  interesting_fact: string
} | null> {
  const word = await getWordleAnswer(dateStr)

  if (!word) {
    return null
  }

  // Use ChatGPT to generate accurate definition and interesting fact
  const { callOpenAI } = await import('./openai')

  try {
    const definitionPrompt = `Provide a brief, clear definition of the word "${word}". Keep it under 50 words and make it suitable for a general audience. Return only the definition with no extra formatting or preamble.`
    const definitionResult = await callOpenAI(definitionPrompt, 100, 0.2)
    const definition = (typeof definitionResult === 'string' ? definitionResult : definitionResult?.raw || '').trim()

    const factPrompt = `Share one interesting fact about the word "${word}" - its etymology, historical usage, or linguistic background. Keep it under 80 words and make it engaging. Return only the fact with no extra formatting or preamble.`
    const factResult = await callOpenAI(factPrompt, 150, 0.3)
    const interesting_fact = (typeof factResult === 'string' ? factResult : factResult?.raw || '').trim()

    return {
      word,
      definition: definition || getBasicDefinition(word),
      interesting_fact: interesting_fact || getInterestingFact(word)
    }
  } catch (error) {
    console.error('Error generating ChatGPT definition/fact:', error)
    // Fall back to basic definitions if ChatGPT fails
    return {
      word,
      definition: getBasicDefinition(word),
      interesting_fact: getInterestingFact(word)
    }
  }
}

export { getPuzzleNumber, getWordleAnswer }