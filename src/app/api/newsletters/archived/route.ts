import { NextResponse } from 'next/server'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export async function GET() {
  try {
    const newsletters = await newsletterArchiver.getArchiveList(100)

    return NextResponse.json({
      success: true,
      newsletters,
      total: newsletters.length
    })
  } catch (error: any) {
    console.error('Error fetching archived newsletters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletters', details: error.message },
      { status: 500 }
    )
  }
}
