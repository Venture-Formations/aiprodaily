'use client'

interface ReferenceGuideProps {
  promptType: string
}

export default function ReferenceGuide({ promptType }: ReferenceGuideProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Reference Guide</h2>

      {/* Placeholders */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Available Placeholders</h3>

        {/* RSS Post Placeholders - always shown */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">RSS Post Data</div>
          <div className="font-mono">
            <span className="text-blue-600">{'{{title}}'}</span>
            <span className="text-gray-600 ml-2">- Article title from RSS feed</span>
          </div>
          <div className="font-mono">
            <span className="text-blue-600">{'{{headline}}'}</span>
            <span className="text-gray-600 ml-2">- Same as title (alias)</span>
          </div>
          <div className="font-mono">
            <span className="text-blue-600">{'{{description}}'}</span>
            <span className="text-gray-600 ml-2">- Article description/summary</span>
          </div>
          <div className="font-mono">
            <span className="text-blue-600">{'{{summary}}'}</span>
            <span className="text-gray-600 ml-2">- Same as description (alias)</span>
          </div>
          <div className="font-mono">
            <span className="text-blue-600">{'{{content}}'}</span>
            <span className="text-gray-600 ml-2">- Full article text (scraped)</span>
          </div>
          <div className="font-mono">
            <span className="text-blue-600">{'{{url}}'}</span>
            <span className="text-gray-600 ml-2">- Article source URL</span>
          </div>
        </div>

        {/* Dynamic Placeholders */}
        <div className="bg-green-50 rounded-lg p-4 space-y-2 text-sm mb-3">
          <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Dynamic Values</div>
          <div className="font-mono">
            <span className="text-green-600">{'{{random_X-Y}}'}</span>
            <span className="text-gray-600 ml-2">- Random integer from X to Y</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Examples: <code className="bg-white px-1 rounded">{'{{random_1-8}}'}</code> &rarr; 1-8, <code className="bg-white px-1 rounded">{'{{random_10-25}}'}</code> &rarr; 10-25
          </div>
        </div>

        {/* Newsletter Context Placeholders - only for Custom/Freeform */}
        {promptType === 'custom' && (
          <div className="bg-purple-50 rounded-lg p-4 space-y-3 text-sm border border-purple-200">
            <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
              Newsletter Context (from last sent issue)
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Basic:</div>
              <div className="font-mono text-xs space-y-1 ml-2">
                <div><span className="text-purple-600">{'{{issue_date}}'}</span> <span className="text-gray-500">- Issue date</span></div>
                <div><span className="text-purple-600">{'{{publication_name}}'}</span> <span className="text-gray-500">- Newsletter name</span></div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Section Articles:</div>
              <div className="font-mono text-xs space-y-1 ml-2">
                <div><span className="text-purple-600">{'{{section_1_name}}'}</span> <span className="text-gray-500">- Section name</span></div>
                <div><span className="text-purple-600">{'{{section_1_all_articles}}'}</span> <span className="text-gray-500">- All articles in section</span></div>
                <div><span className="text-purple-600">{'{{section_2_all_articles}}'}</span> <span className="text-gray-500">- Section 2, etc.</span></div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Individual Articles:</div>
              <div className="font-mono text-xs space-y-1 ml-2">
                <div><span className="text-purple-600">{'{{section_1_article_1_headline}}'}</span></div>
                <div><span className="text-purple-600">{'{{section_1_article_1_content}}'}</span></div>
                <div className="text-gray-500 text-xs">Pattern: section_N_article_M_headline/content</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">AI Apps:</div>
              <div className="font-mono text-xs space-y-1 ml-2">
                <div><span className="text-purple-600">{'{{ai_app_1_name}}'}</span>, <span className="text-purple-600">{'{{ai_app_1_tagline}}'}</span>, <span className="text-purple-600">{'{{ai_app_1_description}}'}</span></div>
                <div className="text-gray-500 text-xs">Pattern: ai_app_N_name/tagline/description</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Poll:</div>
              <div className="font-mono text-xs space-y-1 ml-2">
                <div><span className="text-purple-600">{'{{poll_question}}'}</span>, <span className="text-purple-600">{'{{poll_options}}'}</span></div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Ads:</div>
              <div className="font-mono text-xs space-y-1 ml-2">
                <div><span className="text-purple-600">{'{{ad_1_title}}'}</span>, <span className="text-purple-600">{'{{ad_1_body}}'}</span></div>
                <div className="text-gray-500 text-xs">Pattern: ad_N_title/body</div>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-3">
          {promptType === 'custom'
            ? 'Custom/Freeform supports both RSS post placeholders and newsletter context placeholders from the most recent sent issue.'
            : 'Use these placeholders in your prompt content. They will be replaced with actual post data when testing.'}
        </p>
      </div>

      {/* Expected Response Formats */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Expected Response Formats</h3>
        <div className="space-y-3 text-xs">
          <div>
            <div className="font-semibold text-gray-700 mb-1">Primary/Secondary Title:</div>
            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "headline": "string"
}`}
            </pre>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Primary/Secondary Body:</div>
            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "content": "string",
  "word_count": integer
}`}
            </pre>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Post Scorer:</div>
            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "score": integer,
  "reasoning": "string"
}`}
            </pre>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Subject Line:</div>
            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "subject_line": "string"
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Important Note */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Important</h3>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-gray-700">
          <p className="font-medium mb-2">Accepts two JSON formats:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Full API Request:</strong> Include model, messages, temperature, max_output_tokens, etc.</li>
            <li><strong>Text Box Format:</strong> <code className="bg-white px-1 rounded">{'{"prompt": "...", "model": "gpt-4o", "max_tokens": 500}'}</code></li>
            <li>Use placeholders like <code className="bg-white px-1 rounded">{'{{title}}'}</code>, <code className="bg-white px-1 rounded">{'{{description}}'}</code>, <code className="bg-white px-1 rounded">{'{{content}}'}</code>, <code className="bg-white px-1 rounded">{'{{random_X-Y}}'}</code></li>
            <li>JSON is sent to API exactly as-is (only placeholders replaced)</li>
            <li>For OpenAI: Use <code className="bg-white px-1 rounded">max_output_tokens</code> (not max_tokens)</li>
            <li>For GPT-5: You can include reasoning parameters like <code className="bg-white px-1 rounded">{'{"reasoning": {"effort": "low", "budget_tokens": 150}}'}</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
