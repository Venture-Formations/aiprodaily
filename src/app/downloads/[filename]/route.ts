import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { getModuleLogger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const log = getModuleLogger('downloads/[filename]')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const decoded = decodeURIComponent(filename)

  if (decoded.includes('/') || decoded.includes('..') || decoded.startsWith('.')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || ''
  const cleanHost = host.split(':')[0]

  if (!cleanHost) {
    return new NextResponse('Not found', { status: 404 })
  }

  const altHost = cleanHost.startsWith('www.')
    ? cleanHost.replace('www.', '')
    : `www.${cleanHost}`

  const { data: pub } = await supabaseAdmin
    .from('publications')
    .select('id, slug')
    .in('website_domain', [cleanHost, altHost])
    .eq('is_active', true)
    .maybeSingle()

  if (!pub?.slug) {
    log.warn({ host: cleanHost }, 'No publication found for download host')
    return new NextResponse('Not found', { status: 404 })
  }

  const objectPath = `${pub.slug}/${decoded}`

  const { data: file, error } = await supabaseAdmin
    .storage
    .from('documents')
    .download(objectPath)

  if (error || !file) {
    log.warn({ publicationSlug: pub.slug, objectPath, err: error?.message }, 'Download not found')
    return new NextResponse('Not found', { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': file.type || 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${decoded.replace(/"/g, '')}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
