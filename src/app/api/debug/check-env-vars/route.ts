import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const envVars = {
      GOOGLE_CLOUD_TYPE: !!process.env.GOOGLE_CLOUD_TYPE,
      GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      GOOGLE_CLOUD_PRIVATE_KEY_ID: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
      GOOGLE_CLOUD_PRIVATE_KEY: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GOOGLE_CLOUD_PRIVATE_KEY.length > 0,
      GOOGLE_CLOUD_CLIENT_EMAIL: !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      GOOGLE_CLOUD_CLIENT_ID: !!process.env.GOOGLE_CLOUD_CLIENT_ID,
      GOOGLE_CLOUD_CREDENTIALS_JSON: !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
    }

    const values = {
      GOOGLE_CLOUD_TYPE: process.env.GOOGLE_CLOUD_TYPE,
      GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
      GOOGLE_CLOUD_PRIVATE_KEY_ID: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
      GOOGLE_CLOUD_PRIVATE_KEY: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? `${process.env.GOOGLE_CLOUD_PRIVATE_KEY.substring(0, 50)}...` : 'missing',
      GOOGLE_CLOUD_CLIENT_EMAIL: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      GOOGLE_CLOUD_CLIENT_ID: process.env.GOOGLE_CLOUD_CLIENT_ID,
      GOOGLE_CLOUD_CREDENTIALS_JSON_LENGTH: process.env.GOOGLE_CLOUD_CREDENTIALS_JSON?.length || 0
    }

    const hasIndividualVars = !!(process.env.GOOGLE_CLOUD_TYPE && process.env.GOOGLE_CLOUD_PRIVATE_KEY)
    const hasJsonCredentials = !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON

    return NextResponse.json({
      success: true,
      hasIndividualVars,
      hasJsonCredentials,
      envVarsPresent: envVars,
      values: values,
      message: hasIndividualVars ? 'Individual variables detected' : 'No individual variables, falling back to JSON'
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}