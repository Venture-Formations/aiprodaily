import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/middleware-test' },
  async ({ request, logger }) => {
  const hostname = request.headers.get('host') || ''
  const adminDomains = ['aiprodaily.com', 'www.aiprodaily.com', 'aiprodaily.vercel.app']
  const isAdminDomain = adminDomains.includes(hostname)

  return NextResponse.json({
    success: true,
    hostname,
    isAdminDomain,
    adminDomains,
    middlewareHeader: request.headers.get('x-middleware-ran'),
    allHeaders: Object.fromEntries(request.headers.entries())
  })
  }
)
