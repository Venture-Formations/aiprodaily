import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('Starting images table schema migration...')

    // Add the new columns
    const migrations = [
      {
        name: 'Add source column',
        sql: 'ALTER TABLE images ADD COLUMN IF NOT EXISTS source TEXT'
      },
      {
        name: 'Add original_file_name column',
        sql: 'ALTER TABLE images ADD COLUMN IF NOT EXISTS original_file_name TEXT'
      },
      {
        name: 'Add city column',
        sql: 'ALTER TABLE images ADD COLUMN IF NOT EXISTS city TEXT'
      },
      {
        name: 'Copy location data to city',
        sql: 'UPDATE images SET city = location WHERE location IS NOT NULL AND city IS NULL'
      },
      {
        name: 'Add city index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_images_city ON images(city)'
      },
      {
        name: 'Add source index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_images_source ON images(source)'
      },
      {
        name: 'Add original_file_name index',
        sql: 'CREATE INDEX IF NOT EXISTS idx_images_original_file_name ON images(original_file_name)'
      }
    ]

    const results = []

    for (const migration of migrations) {
      try {
        console.log(`Executing: ${migration.name}`)
        const { error } = await supabaseAdmin.rpc('exec_sql', {
          sql_query: migration.sql
        })

        if (error) {
          console.error(`Error in ${migration.name}:`, error)
          results.push({
            migration: migration.name,
            status: 'error',
            error: error.message
          })
        } else {
          console.log(`✅ ${migration.name} completed`)
          results.push({
            migration: migration.name,
            status: 'success'
          })
        }
      } catch (err) {
        console.error(`Exception in ${migration.name}:`, err)
        results.push({
          migration: migration.name,
          status: 'exception',
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    // Verify the schema changes
    console.log('Verifying schema changes...')
    const { data: columns, error: schemaError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'images')
      .in('column_name', ['city', 'source', 'original_file_name', 'location'])
      .order('column_name')

    if (schemaError) {
      console.error('Schema verification error:', schemaError)
    }

    return NextResponse.json({
      success: true,
      message: 'Database migration completed',
      migration_results: results,
      schema_verification: columns || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Migration API error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  // Alternative method using direct SQL execution
  try {
    const { sql } = await request.json()

    if (!sql) {
      return NextResponse.json(
        { error: 'SQL query required' },
        { status: 400 }
      )
    }

    console.log('Executing custom SQL:', sql)

    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: sql
    })

    if (error) {
      console.error('SQL execution error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      result: data,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Custom SQL API error:', error)
    return NextResponse.json(
      {
        error: 'SQL execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}