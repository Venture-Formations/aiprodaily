import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export const GET = withApiHandler(
  { authTier: 'public', logContext: 'newsletters-archived' },
  async ({ request, logger }) => {
    const newsletters = await newsletterArchiver.getArchiveList(100)

    return NextResponse.json({
      success: true,
      newsletters,
      total: newsletters.length
    })
  }
)
