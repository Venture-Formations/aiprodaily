import { NextResponse } from 'next/server'

export async function GET() {
  // CSV headers - google_cid will be converted to google_profile URL
  const headers = [
    'business_name',
    'business_address',
    'google_cid',
    'day_of_week',
    'special_description',
    'special_time',
    'is_featured',
    'paid_placement'
  ]

  // Sample rows with example data (special_description max 65 chars)
  const sampleRows = [
    [
      'Example - The Local Eatery',
      '123 Main St, St. Cloud, MN 56301',
      '1234567890123456789',
      'Monday',
      '$5 Burgers and Fries',
      '11AM - 2PM',
      'FALSE',
      'FALSE'
    ],
    [
      'Example - Downtown Bistro',
      '456 1st Ave S, St. Cloud, MN 56301',
      '9876543210987654321',
      'Tuesday',
      'Half-price appetizers all day',
      'All day',
      'TRUE',
      'FALSE'
    ]
  ]

  // Combine headers and sample rows
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Return CSV file
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="dining_deals_template.csv"'
    }
  })
}
