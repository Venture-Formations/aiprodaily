import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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
