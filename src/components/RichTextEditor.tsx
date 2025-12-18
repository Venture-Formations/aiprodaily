'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  maxWords?: number
  placeholder?: string
}

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

export default function RichTextEditor({ value, onChange, maxWords = 100, placeholder = 'Enter text...' }: RichTextEditorProps) {
  const [wordCount, setWordCount] = useState(0)
  const [editorValue, setEditorValue] = useState(value)
  const [isOverLimit, setIsOverLimit] = useState(false)
  // Track if the last change came from the editor to avoid sync loops
  const isInternalChange = useRef(false)

  // Update local state when prop changes from external source
  useEffect(() => {
    // Skip if the change originated from the editor itself
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    // Only update if the value actually differs
    if (value !== editorValue) {
      setEditorValue(value)
      updateWordCount(value)
    }
  }, [value])

  const updateWordCount = (html: string) => {
    const text = html.replace(/<[^>]+>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    setWordCount(words.length)
    setIsOverLimit(words.length > maxWords)
  }

  const handleChange = (content: string) => {
    const text = content.replace(/<[^>]+>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    const overLimit = words.length > maxWords

    // Mark this as an internal change so the useEffect doesn't override it
    isInternalChange.current = true

    // Always update local state and word count so user sees their typing
    setEditorValue(content)
    setWordCount(words.length)
    setIsOverLimit(overLimit)

    // Always call onChange - let the parent handle validation if needed
    // This ensures the form state is always in sync with the editor
    onChange(content)
  }

  // Quill toolbar configuration
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      [{ 'color': [] }]
    ],
  }), [])

  const formats = [
    'bold', 'italic', 'underline',
    'list',
    'link',
    'color'
  ]

  return (
    <div className="border border-gray-300 rounded-md">
      {/* Toolbar is built into Quill */}
      <ReactQuill
        theme="snow"
        value={editorValue}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="rich-text-editor"
      />

      {/* Word count display */}
      <div className="flex justify-end p-2 border-t border-gray-300 bg-gray-50">
        <span className={`text-sm ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
          {wordCount} / {maxWords} words
          {isOverLimit && <span className="ml-2">(over limit!)</span>}
        </span>
      </div>

      <style jsx global>{`
        .rich-text-editor .ql-container {
          min-height: 200px;
          font-family: inherit;
        }
        .rich-text-editor .ql-editor {
          min-height: 200px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9CA3AF;
          font-style: normal;
        }
      `}</style>
    </div>
  )
}
