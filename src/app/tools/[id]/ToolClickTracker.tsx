'use client'

interface ToolClickTrackerProps {
  toolId: string
  websiteUrl: string
  children: React.ReactNode
  className?: string
}

export function ToolClickTracker({ toolId, websiteUrl, children, className }: ToolClickTrackerProps) {
  const handleClick = () => {
    // Fire and forget - don't block navigation
    fetch('/api/tools/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId })
    }).catch(() => {})
  }

  return (
    <a
      href={websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  )
}
