import { openai } from './clients'

// Special function for road work generation using Responses API with web search
export async function callOpenAIWithWebSearch(systemPrompt: string, userPrompt: string): Promise<any> {
  const controller = new AbortController()
  try {
    console.log('Making OpenAI Responses API request with web search...')
    console.log('System prompt length:', systemPrompt.length)
    console.log('User prompt length:', userPrompt.length)

    const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) timeout for web search

    try {
      console.log('Using GPT-4o model with web search tools...')

      // Use the Responses API with web tools as provided by the user
      const response = await (openai as any).responses.create({
        model: 'gpt-4o',
        tools: [{ type: 'web_search_preview' }], // correct web search tool type
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Log the full response structure for debugging
      console.log('Full response structure:', JSON.stringify(response, null, 2).substring(0, 1000))

      // Extract the response text using the format from the user's example
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      const text = jsonSchemaItem?.json ??                         // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??         // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        ""

      if (!text) {
        console.error('No text found in response. Response keys:', Object.keys(response))
        throw new Error('No response from OpenAI Responses API')
      }

      console.log('OpenAI Responses API response received, length:', text.length)
      console.log('Response preview:', text.substring(0, 500))

      // Extract JSON array from the response
      const start = text.indexOf("[")
      const end = text.lastIndexOf("]")

      if (start === -1 || end === -1) {
        console.warn('No JSON array found in response')
        console.warn('Full response text:', text.substring(0, 1000))
        return { raw: text }
      }

      const jsonString = text.slice(start, end + 1)
      console.log('Extracted JSON string length:', jsonString.length)
      console.log('JSON preview:', jsonString.substring(0, 300))

      try {
        const parsedData = JSON.parse(jsonString)
        console.log('Successfully parsed road work data:', parsedData.length, 'items')
        if (parsedData.length > 0) {
          console.log('First item:', JSON.stringify(parsedData[0], null, 2))
        }
        return parsedData
      } catch (parseError) {
        console.error('Failed to parse extracted JSON:', parseError)
        console.error('JSON string:', jsonString.substring(0, 500))
        return { raw: text }
      }

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    const errorMsg = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error)
    console.error('OpenAI Responses API error:', errorMsg)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error name:', error.name)
    }
    throw error
  }
}
