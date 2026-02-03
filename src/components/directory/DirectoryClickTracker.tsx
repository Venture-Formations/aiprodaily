'use client'

import Link from 'next/link'

type ClickType = 'category_click' | 'tool_view' | 'external_link'

interface DirectoryClickTrackerProps {
  clickType: ClickType
  href: string
  toolId?: string
  toolName?: string
  categorySlug?: string
  categoryName?: string
  referrerPage: string
  referrerType: string
  destinationUrl?: string
  external?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Unified click tracker for the AI Tools Directory.
 * Wraps links and sends tracking data on click (fire-and-forget).
 *
 * Click types:
 * - category_click: User clicks a category card/link
 * - tool_view: User clicks a tool card to view details
 * - external_link: User clicks to visit the tool's website
 */
export function DirectoryClickTracker({
  clickType,
  href,
  toolId,
  toolName,
  categorySlug,
  categoryName,
  referrerPage,
  referrerType,
  destinationUrl,
  external = false,
  children,
  className
}: DirectoryClickTrackerProps) {
  const handleClick = () => {
    // Fire and forget - don't block navigation
    fetch('/api/tools/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clickType,
        toolId,
        toolName,
        categorySlug,
        categoryName,
        referrerPage,
        referrerType,
        destinationUrl
      })
    }).catch(() => {
      // Silently fail - tracking should never block user
    })
  }

  // External links use <a> tag with target="_blank"
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>
    )
  }

  // Internal links use Next.js Link
  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  )
}

/**
 * Simplified tracker for category clicks.
 */
export function CategoryClickTracker({
  categorySlug,
  categoryName,
  referrerPage,
  referrerType,
  children,
  className
}: {
  categorySlug: string
  categoryName: string
  referrerPage: string
  referrerType: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <DirectoryClickTracker
      clickType="category_click"
      href={`/tools/category/${categorySlug}`}
      categorySlug={categorySlug}
      categoryName={categoryName}
      referrerPage={referrerPage}
      referrerType={referrerType}
      className={className}
    >
      {children}
    </DirectoryClickTracker>
  )
}

/**
 * Simplified tracker for tool view clicks (clicking a tool card).
 */
export function ToolViewTracker({
  toolId,
  toolName,
  categorySlug,
  categoryName,
  referrerPage,
  referrerType,
  children,
  className
}: {
  toolId: string
  toolName: string
  categorySlug?: string
  categoryName?: string
  referrerPage: string
  referrerType: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <DirectoryClickTracker
      clickType="tool_view"
      href={`/tools/${toolId}`}
      toolId={toolId}
      toolName={toolName}
      categorySlug={categorySlug}
      categoryName={categoryName}
      referrerPage={referrerPage}
      referrerType={referrerType}
      className={className}
    >
      {children}
    </DirectoryClickTracker>
  )
}

/**
 * Simplified tracker for external link clicks (Visit Website button).
 */
export function ExternalLinkTracker({
  toolId,
  toolName,
  websiteUrl,
  referrerPage,
  referrerType,
  children,
  className
}: {
  toolId: string
  toolName: string
  websiteUrl: string
  referrerPage: string
  referrerType: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <DirectoryClickTracker
      clickType="external_link"
      href={websiteUrl}
      toolId={toolId}
      toolName={toolName}
      destinationUrl={websiteUrl}
      referrerPage={referrerPage}
      referrerType={referrerType}
      external={true}
      className={className}
    >
      {children}
    </DirectoryClickTracker>
  )
}
