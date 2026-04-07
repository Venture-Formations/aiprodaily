import type { DatePreset, ScoredPost } from './types'

export function toLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateRange(preset: DatePreset): { from: string; to: string } {
  if (preset === 'custom') return { from: '', to: '' }
  const today = new Date()
  const to = toLocalDateString(today)
  const from = new Date(today)
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  from.setDate(from.getDate() - daysMap[preset])
  return { from: toLocalDateString(from), to }
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-')
      return `${parseInt(month)}/${parseInt(day)}/${year}`
    }
    return new Date(dateStr).toLocaleDateString('en-US', { timeZone: 'UTC' })
  } catch {
    return dateStr
  }
}

export function getColumnWidthClass(width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string {
  switch (width) {
    case 'xs': return 'w-14 min-w-[3.5rem] max-w-[4rem]'
    case 'sm': return 'w-20 min-w-[5rem] max-w-[6rem]'
    case 'md': return 'w-28 min-w-[7rem] max-w-[8rem]'
    case 'lg': return 'w-44 min-w-[11rem] max-w-[14rem]'
    case 'xl': return 'w-64 min-w-[16rem] max-w-[20rem]'
    default: return 'w-24'
  }
}

export function getColumnValue(post: ScoredPost, key: string): string {
  const value = post[key as keyof ScoredPost]
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toString()
  return value.toString()
}
