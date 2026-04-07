'use client'

import type { AIPromptEditorProps } from './types'
import { detectProviderFromPrompt } from './types'

export function AIPromptBlockEditor({
  block,
  isEditing,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveBlock,
  editPrompt,
  setEditPrompt,
  editTiming,
  setEditTiming,
  editIsBold,
  setEditIsBold,
  editIsItalic,
  setEditIsItalic,
  editResponseField,
  setEditResponseField,
  testingPrompt,
  testResult,
  onTestPrompt,
}: AIPromptEditorProps) {
  if (isEditing) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">AI Prompt (Full JSON)</label>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder='{"model": "gpt-4o", "messages": [{"role": "user", "content": "Your prompt here"}]}'
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
          />
          <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs font-medium text-blue-800 mb-1">Full JSON Format Required</div>
            <div className="text-xs text-blue-700">
              Paste your complete API request JSON with model, messages/system, etc. Test in the AI Prompt Testing playground first.
            </div>
          </div>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-medium text-gray-700 mb-2">Available Placeholders:</div>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Basic:</strong> {'{{issue_date}}'}, {'{{publication_name}}'}, {'{{random_X-Y}}'} <span className="text-gray-400">(random integer)</span></p>
              <p><strong>Section Articles:</strong> {'{{section_1_all_articles}}'}, {'{{section_2_all_articles}}'}</p>
              <p><strong>Individual:</strong> {'{{section_1_article_1_headline}}'}, {'{{section_1_article_1_content}}'}</p>
              <p><strong>Other:</strong> {'{{ai_app_1_name}}'}, {'{{poll_question}}'}, {'{{ad_1_title}}'}</p>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Generation Timing</label>
          <select value={editTiming} onChange={(e) => setEditTiming(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm">
            <option value="before_articles">Before Articles (basic context only)</option>
            <option value="after_articles">After Articles (full newsletter context)</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`bold-${block.id}`}
              checked={editIsBold}
              onChange={(e) => setEditIsBold(e.target.checked)}
              className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
            />
            <label htmlFor={`bold-${block.id}`} className="text-sm text-gray-700">
              <span className="font-medium">Bold</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`italic-${block.id}`}
              checked={editIsItalic}
              onChange={(e) => setEditIsItalic(e.target.checked)}
              className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
            />
            <label htmlFor={`italic-${block.id}`} className="text-sm text-gray-700">
              <span className="font-medium">Italic</span>
            </label>
          </div>
          <span className="text-xs text-gray-500">Style the AI-generated content</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Response Field (optional)</label>
          <input
            type="text"
            value={editResponseField}
            onChange={(e) => setEditResponseField(e.target.value)}
            placeholder="e.g., Summary, content, joke_text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
          {!editResponseField.trim() && (
            <p className="mt-1.5 text-xs text-gray-500">
              Expects: Plain text OR JSON with lowercase field: <code className="bg-gray-100 px-1 rounded">summary</code>, <code className="bg-gray-100 px-1 rounded">content</code>, <code className="bg-gray-100 px-1 rounded">text</code>, <code className="bg-gray-100 px-1 rounded">body</code>, <code className="bg-gray-100 px-1 rounded">raw</code>, <code className="bg-gray-100 px-1 rounded">response</code>, <code className="bg-gray-100 px-1 rounded">output</code>, <code className="bg-gray-100 px-1 rounded">result</code>, or <code className="bg-gray-100 px-1 rounded">message</code>
            </p>
          )}
        </div>
        {testResult && (
          <div className={`p-4 rounded-lg border ${testResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            {testResult.error ? <div className="text-sm text-red-700">{testResult.error}</div> : (
              <div className="space-y-3">
                <div><div className="text-xs font-medium text-gray-600 mb-1">Injected Prompt:</div><div className="bg-white p-2 rounded border border-gray-200 text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">{testResult.injectedPrompt}</div></div>
                <div><div className="text-xs font-medium text-gray-600 mb-1">AI Response:</div><div className="bg-white p-2 rounded border border-gray-200 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">{testResult.result}</div></div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between items-center pt-2">
          <button onClick={onTestPrompt} disabled={testingPrompt || !editPrompt.trim()} className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed">{testingPrompt ? 'Testing...' : 'Test Prompt'}</button>
          <div className="flex gap-2">
            <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => onSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Full JSON Prompt</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${detectProviderFromPrompt(block.ai_prompt_json) === 'claude' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{detectProviderFromPrompt(block.ai_prompt_json) === 'claude' ? 'Claude' : 'OpenAI'}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{block.ai_prompt_json ? JSON.stringify(block.ai_prompt_json, null, 2) : <span className="italic text-gray-400">No prompt configured</span>}</div>
      </div>
      <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 mb-3">
        <span>Timing: {block.generation_timing === 'before_articles' ? 'Before Articles' : 'After Articles'}</span>
        {block.is_bold && (
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">Bold</span>
        )}
        {block.is_italic && (
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">Italic</span>
        )}
        {(block.ai_prompt_json as any)?.response_field && (
          <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded font-medium">
            Response Field: {(block.ai_prompt_json as any).response_field}
          </span>
        )}
      </div>
      <button onClick={() => onStartEdit(block)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Prompt</button>
    </div>
  )
}
