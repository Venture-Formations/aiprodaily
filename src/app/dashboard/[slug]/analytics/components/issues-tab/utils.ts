export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}
