import { NextResponse } from 'next/server'

export async function GET() {
  // CSV headers for VRBO listings
  const headers = [
    'title',
    'main_image_url',
    'city',
    'bedrooms',
    'bathrooms',
    'sleeps',
    'link',
    'non_tracked_link',
    'listing_type'
  ]

  // Sample rows with example data
  const sampleRows = [
    [
      'Example - Cozy Lakefront Cabin',
      'https://www.example.com/images/cabin.jpg',
      'St. Cloud',
      '3',
      '2',
      '8',
      'https://vrbo.com/affiliates/2517038.qZzyrnV',
      'https://www.vrbo.com/12345678',
      'Local'
    ],
    [
      'Example - Modern Downtown Loft',
      'https://www.example.com/images/loft.jpg',
      'Minneapolis',
      '2',
      '1',
      '4',
      'https://vrbo.com/affiliates/3428176.pRxMnQa',
      '',
      'Greater'
    ],
    [
      'Example - Charming Cottage',
      'https://www.example.com/images/cottage.jpg',
      'Sartell',
      '2',
      '1.5',
      '6',
      'https://vrbo.com/affiliates/1829452.vKlWpTn',
      '',
      'Local'
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
      'Content-Disposition': 'attachment; filename="vrbo_template.csv"'
    }
  })
}
