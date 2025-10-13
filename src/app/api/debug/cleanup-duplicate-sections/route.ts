import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Analyzing newsletter sections for duplicates...')

    // Get all sections
    const { data: allSections, error: fetchError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order', { ascending: true })

    if (fetchError) {
      throw fetchError
    }

    // Group sections by name to find duplicates
    const sectionsByName: Record<string, any[]> = {}
    for (const section of allSections || []) {
      if (!sectionsByName[section.name]) {
        sectionsByName[section.name] = []
      }
      sectionsByName[section.name].push(section)
    }

    // Find duplicates
    const duplicates = Object.entries(sectionsByName)
      .filter(([name, sections]) => sections.length > 1)
      .map(([name, sections]) => ({ name, sections }))

    // Expected sections with their proper display orders
    const expectedSections = {
      'The Local Scoop': 10,
      'Local Events': 20,
      'Local Weather': 30,
      "Yesterday's Wordle": 40,
      'Minnesota Getaways': 50,
      'Dining Deals': 60
    }

    const analysis = {
      totalSections: allSections?.length || 0,
      allSections: allSections || [],
      duplicates,
      sectionsToDelete: [] as any[],
      sectionsToKeep: [] as any[],
      expectedSections
    }

    // For each duplicate, determine which to keep and which to delete
    for (const duplicate of duplicates) {
      const { name, sections } = duplicate
      const expectedOrder = expectedSections[name as keyof typeof expectedSections]

      if (expectedOrder) {
        // Keep the one with the correct display order, or the first one if none match
        const correctSection = sections.find(s => s.display_order === expectedOrder)
        const sectionToKeep = correctSection || sections[0]
        const sectionsToDelete = sections.filter(s => s.id !== sectionToKeep.id)

        analysis.sectionsToKeep.push(sectionToKeep)
        analysis.sectionsToDelete.push(...sectionsToDelete)
      } else {
        // Unknown section - keep the first one
        analysis.sectionsToKeep.push(sections[0])
        analysis.sectionsToDelete.push(...sections.slice(1))
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter sections analysis completed',
      analysis
    })

  } catch (error) {
    console.error('Cleanup analysis error:', error)
    return NextResponse.json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Cleaning up duplicate newsletter sections...')

    // First run the analysis to determine what to delete
    const analysisResponse = await GET(request)
    const analysisData = await analysisResponse.json()

    if (!analysisData.success) {
      return analysisData
    }

    const { sectionsToDelete } = analysisData.analysis

    if (sectionsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicate sections found to clean up',
        deletedCount: 0
      })
    }

    // Delete duplicate sections
    let deletedCount = 0
    for (const section of sectionsToDelete) {
      console.log(`Deleting duplicate section: ${section.name} (ID: ${section.id}, Order: ${section.display_order})`)

      const { error } = await supabaseAdmin
        .from('newsletter_sections')
        .delete()
        .eq('id', section.id)

      if (error) {
        console.error(`Error deleting section ${section.id}:`, error.message)
      } else {
        deletedCount++
      }
    }

    // Get final configuration
    const { data: finalSections, error: selectError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order', { ascending: true })

    if (selectError) {
      throw selectError
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed successfully. Deleted ${deletedCount} duplicate sections.`,
      deletedCount,
      finalSections: finalSections || []
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}