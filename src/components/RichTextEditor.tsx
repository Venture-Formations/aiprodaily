'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  maxWords?: number
  placeholder?: string
}

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

export default function RichTextEditor({ value, onChange, maxWords = 100, placeholder = 'Enter text...' }: RichTextEditorProps) {
  const [wordCount, setWordCount] = useState(0)
  const [editorValue, setEditorValue] = useState(value)

  // Update local state when prop changes
  useEffect(() => {
    setEditorValue(value)
    updateWordCount(value)
  }, [value])

  const updateWordCount = (html: string) => {
    const text = html.replace(/<[^>]+>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    setWordCount(words.length)
  }

  const handleChange = (content: string) => {
    const text = content.replace(/<[^>]+>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)

    // Check word limit
    if (words.length <= maxWords) {
      setEditorValue(content)
      onChange(content)
      updateWordCount(content)
    }
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
    'list', 'bullet',
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
        <span className="text-sm text-gray-600">
          {wordCount} / {maxWords} words
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
