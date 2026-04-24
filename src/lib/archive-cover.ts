import { STORAGE_PUBLIC_URL } from './config'

export const DEFAULT_ARCHIVE_COVER_IMAGE =
  `${STORAGE_PUBLIC_URL}/img/c/ai_accounting_daily_cover_image.jpg`

export interface ArchiveCoverNewsletter {
  metadata?: Record<string, any> | null
}

// Priority (current): publication default → hardcoded fallback.
// Future: per-issue image (e.g. from nl.metadata.cover_image_url) slots in
// as the first branch here without changing call sites.
export function resolveArchiveCoverImage(
  newsletter: ArchiveCoverNewsletter,
  publicationDefault?: string | null
): string {
  void newsletter
  return publicationDefault || DEFAULT_ARCHIVE_COVER_IMAGE
}
