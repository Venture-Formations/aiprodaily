'use client'

interface ToolClickTrackerProps {
  toolId: string
  toolName: string
  websiteUrl: string
  children: React.ReactNode
  className?: string
}

/**
 * Tracks external link clicks (Visit Website button) on tool detail pages.
 * Sends detailed tracking data to the analytics system.
 */
export function ToolClickTracker({ toolId, toolName, websiteUrl, children, className }: ToolClickTrackerProps) {
  const handleClick = () => {
    // Fire and forget - don't block navigation
    fetch('/api/tools/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clickType: 'external_link',
        toolId,
        toolName,
        destinationUrl: websiteUrl,
        referrerPage: `/tools/${toolId}`,
        referrerType: 'tool_detail'
      })
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
