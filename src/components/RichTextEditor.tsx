'use client'

import { useState, useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  maxWords?: number
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, maxWords = 100, placeholder = 'Enter text...' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [wordCount, setWordCount] = useState(0)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [savedRange, setSavedRange] = useState<Range | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#000000')

  // Track if we're currently inserting a link to prevent reset
  const [isInsertingLink, setIsInsertingLink] = useState(false)

  // Initialize editor with value
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value && !isInsertingLink) {
      editorRef.current.innerHTML = value
      updateWordCount(value)
    }
  }, [value, isInsertingLink])

  const updateWordCount = (html: string) => {
    const text = html.replace(/<[^>]*>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    setWordCount(words.length)
  }

  const handleInput = (forceUpdate = false) => {
    if (!editorRef.current) return

    const html = editorRef.current.innerHTML
    updateWordCount(html)

    // Check word limit
    const text = html.replace(/<[^>]*>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)

    if (words.length <= maxWords || forceUpdate) {
      onChange(html)
    } else {
      // Revert to previous value if word limit exceeded
      editorRef.current.innerHTML = value
      updateWordCount(value)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    handleInput()
  }

  const openLinkModal = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange()
      const selectedText = selection.toString()

      // If text is selected, use it as link text
      // If not, user will need to type link text
      setLinkText(selectedText)
      setSavedRange(range)
      setShowLinkModal(true)
    } else {
      alert('Please click in the editor first to position your cursor')
    }
  }

  const applyColor = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) {
      document.execCommand('foreColor', false, selectedColor)
      handleInput()
      setShowColorPicker(false)
    } else {
      alert('Please select text first to change color')
    }
  }

  const insertLink = () => {
    if (!linkUrl || !linkText || !savedRange || !editorRef.current) {
      alert('Please enter both link text and URL')
      return
    }

    // Prevent useEffect from resetting content
    setIsInsertingLink(true)

    try {
      // Focus the editor
      editorRef.current.focus()

      // Restore the saved range
      const selection = window.getSelection()
      if (!selection) {
        throw new Error('No selection available')
      }

      selection.removeAllRanges()
      selection.addRange(savedRange)

      // Delete any selected content first
      savedRange.deleteContents()

      // Create the link element
      const fullUrl = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
      const link = document.createElement('a')
      link.href = fullUrl
      link.textContent = linkText
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
      // Don't set inline styles - let CSS provide default, but allow override

      // Insert the link at the saved position
      savedRange.insertNode(link)

      // Add a space after for easier editing
      const space = document.createTextNode('\u00A0')
      if (link.nextSibling) {
        link.parentNode?.insertBefore(space, link.nextSibling)
      } else {
        link.parentNode?.appendChild(space)
      }

      // Move cursor after the link
      const newRange = document.createRange()
      newRange.setStartAfter(space)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)

      // Update the parent component
      onChange(editorRef.current.innerHTML)
      updateWordCount(editorRef.current.innerHTML)

      // Re-enable useEffect after delay
      setTimeout(() => setIsInsertingLink(false), 100)
    } catch (error) {
      console.error('Error inserting link:', error)
      alert(`Failed to insert link: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsInsertingLink(false)
    }

    // Close modal and reset
    setShowLinkModal(false)
    setLinkUrl('')
    setLinkText('')
    setSavedRange(null)
  }

  return (
    <div className="border border-gray-300 rounded-md">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="px-3 py-1 hover:bg-gray-200 rounded font-bold"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="px-3 py-1 hover:bg-gray-200 rounded italic"
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="px-3 py-1 hover:bg-gray-200 rounded underline"
          title="Underline"
        >
          U
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="px-3 py-1 hover:bg-gray-200 rounded"
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="px-3 py-1 hover:bg-gray-200 rounded"
          title="Numbered List"
        >
          1.
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={openLinkModal}
          className="px-3 py-1 hover:bg-gray-200 rounded"
          title="Insert Link"
        >
          🔗
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="px-3 py-1 hover:bg-gray-200 rounded flex items-center gap-1"
            title="Text Color"
          >
            <span style={{ color: selectedColor }}>A</span>
            <span className="text-xs">▼</span>
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-300 rounded shadow-lg z-10">
              <div className="flex flex-col gap-2">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full h-8 cursor-pointer"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={applyColor}
                    className="flex-1 bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="ml-auto text-sm text-gray-600">
          {wordCount} / {maxWords} words
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={() => handleInput()}
        className="p-3 min-h-[200px] focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
        style={{ wordWrap: 'break-word' }}
        data-placeholder={placeholder}
      />

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Insert Link</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Link Text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Text to display"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={insertLink}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Insert Link
              </button>
              <button
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkUrl('')
                  setLinkText('')
                  setSavedRange(null)
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        /* Default link styling - but can be overridden by user formatting */
        div[contenteditable] a {
          color: #2563EB;
          text-decoration: underline;
          cursor: pointer;
        }
        div[contenteditable] a:hover {
          color: #1D4ED8;
        }
      `}</style>
    </div>
  )
}
