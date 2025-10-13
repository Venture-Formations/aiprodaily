import { NextResponse } from 'next/server'

export async function GET() {
  // CSV headers with separate date and time fields for easier data entry
  const headers = [
    'external_id',
    'title',
    'description',
    'start_date',
    'start_time',
    'end_date',
    'end_time',
    'venue',
    'address',
    'url',
    'website',
    'image_url',
    'featured',
    'paid_placement'
  ]

  // Sample rows with example data (separate date and time)
  const sampleRows = [
    [
      'example-001',
      'Example - St. Cloud Farmers Market',
      'Fresh local produce, baked goods, and handmade crafts every Saturday morning',
      '2025-10-04',
      '09:00:00',
      '2025-10-04',
      '13:00:00',
      'Downtown Square',
      '123 Main St, St. Cloud, MN 56301',
      '',
      'https://www.farmersmarket.example.com',
      'https://www.example.com/images/market.jpg',
      'FALSE',
      'FALSE'
    ],
    [
      'example-002',
      'Example - Live Music at The Local',
      'Join us for an evening of acoustic folk music featuring local artists',
      '2025-10-05',
      '19:00:00',
      '2025-10-05',
      '22:00:00',
      'The Local Music Venue',
      '456 2nd Ave N, St. Cloud, MN 56301',
      '',
      'https://www.thelocalmusicvenue.example.com',
      'https://www.example.com/images/concert.jpg',
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
      'Content-Disposition': 'attachment; filename="events_template.csv"'
    }
  })
}
