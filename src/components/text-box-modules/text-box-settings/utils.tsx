import React from 'react'

export function getBlockTypeBadge(blockType: string): React.ReactNode {
  switch (blockType) {
    case 'static_text':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Static Text</span>
    case 'ai_prompt':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">AI Generated</span>
    case 'image':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Image</span>
    default:
      return null
  }
}
