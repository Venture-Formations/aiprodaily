// Simple test script to debug AI road work generation
const { AI_PROMPTS } = require('./src/lib/openai.ts')

const today = new Date()
const targetDate = today.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'America/Chicago'
})

console.log('Target date:', targetDate)
console.log('=== AI PROMPT ===')
const prompt = AI_PROMPTS.roadWorkGenerator(targetDate)
console.log(prompt)
console.log('=== END PROMPT ===')