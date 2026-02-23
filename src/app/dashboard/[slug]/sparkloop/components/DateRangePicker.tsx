'use client'

import { Calendar, X } from 'lucide-react'

interface DateRangePickerProps {
  dateStart: string
  dateEnd: string
  dateRangeActive: boolean
  dateRangeLoading: boolean
  onDateStartChange: (value: string) => void
  onDateEndChange: (value: string) => void
  onClearDateRange: () => void
  onSetQuickRange: (days: number) => void
}

export default function DateRangePicker({
  dateStart,
  dateEnd,
  dateRangeActive,
  dateRangeLoading,
  onDateStartChange,
  onDateEndChange,
  onClearDateRange,
  onSetQuickRange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Calendar className="w-4 h-4 text-gray-400" />
      <button
        onClick={() => onSetQuickRange(7)}
        className={`px-2 py-1 text-xs rounded-lg ${
          dateRangeActive && dateStart === new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
            ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      >
        7 Days
      </button>
      <button
        onClick={() => onSetQuickRange(30)}
        className={`px-2 py-1 text-xs rounded-lg ${
          dateRangeActive && dateStart === new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
            ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      >
        30 Days
      </button>
      <span className="text-xs text-gray-300">|</span>
      <input
        type="date"
        value={dateStart}
        onChange={(e) => onDateStartChange(e.target.value)}
        className="px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      <span className="text-xs text-gray-400">to</span>
      <input
        type="date"
        value={dateEnd}
        onChange={(e) => onDateEndChange(e.target.value)}
        className="px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      {(dateStart || dateEnd) && (
        <button
          onClick={onClearDateRange}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
      {dateRangeLoading && (
        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-300 border-t-purple-500" />
      )}
      {dateRangeActive && !dateRangeLoading && (
        <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700">
          Filtered: Popup Impr/Subs/CR, Page Impr/Subs/CR, Conf, Rej, Pend
        </span>
      )}
    </div>
  )
}
