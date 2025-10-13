import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

interface RouteParams {
  params: Promise<{
    campaign: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaign } = await params

    // Fetch campaign metrics
    const { data: metrics, error } = await supabaseAdmin
      .from('email_metrics')
      .select('*')
      .eq('campaign_id', campaign)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Metrics not found' }, { status: 404 })
    }

    return NextResponse.json({ metrics })

  } catch (error) {
    console.error('Failed to fetch analytics:', error)
    return NextResponse.json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaign } = await params

    // Import fresh metrics from MailerLite
    const mailerLiteService = new MailerLiteService()
    const metrics = await mailerLiteService.importCampaignMetrics(campaign)

    return NextResponse.json({
      success: true,
      message: 'Metrics imported successfully',
      metrics
    })

  } catch (error) {
    console.error('Failed to import metrics:', error)
    return NextResponse.json({
      error: 'Failed to import metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}