'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

interface DatePickerProps {
  selectedDates: Date[]
  onDatesChange: (dates: Date[]) => void
  useNextAvailable: boolean
  onToggleNextAvailable: () => void
  nextAvailableDays: number
  onNextAvailableDaysChange: (days: number) => void
  bookedDates?: string[] // Array of ISO date strings that are already booked
}

export function DatePicker({
  selectedDates,
  onDatesChange,
  useNextAvailable,
  onToggleNextAvailable,
  nextAvailableDays,
  onNextAvailableDaysChange,
  bookedDates = []
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (Date | null)[] = []
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }
    
    // Add all days in the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const days = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const isDateBooked = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return bookedDates.includes(dateStr)
  }

  const isDatePast = (date: Date) => {
    return date < today
  }

  const isDateSelected = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return selectedDates.some(d => d.toISOString().split('T')[0] === dateStr)
  }

  const handleDateClick = (date: Date) => {
    if (isDatePast(date) || isDateBooked(date) || useNextAvailable) return
    
    const dateStr = date.toISOString().split('T')[0]
    const isAlreadySelected = selectedDates.some(d => d.toISOString().split('T')[0] === dateStr)
    
    if (isAlreadySelected) {
      // Remove the date
      onDatesChange(selectedDates.filter(d => d.toISOString().split('T')[0] !== dateStr))
    } else {
      // Add the date
      onDatesChange([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()))
    }
  }

  const removeDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    onDatesChange(selectedDates.filter(d => d.toISOString().split('T')[0] !== dateStr))
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  // Don't allow going to past months
  const canGoPrevious = currentMonth > new Date(today.getFullYear(), today.getMonth(), 1)

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <div className={`border border-gray-200 rounded-xl overflow-hidden ${useNextAvailable ? 'opacity-50' : ''}`}>
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <button
            type="button"
            onClick={goToPreviousMonth}
            disabled={!canGoPrevious || useNextAvailable}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900">{monthName}</span>
          <button
            type="button"
            onClick={goToNextMonth}
            disabled={useNextAvailable}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const isPast = isDatePast(date)
            const isBooked = isDateBooked(date)
            const isSelected = isDateSelected(date)
            const isDisabled = isPast || isBooked || useNextAvailable

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleDateClick(date)}
                disabled={isDisabled}
                className={`
                  aspect-square rounded-lg text-sm font-medium transition-all
                  ${isSelected 
                    ? 'bg-[#06b6d4] text-white' 
                    : isPast 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : isBooked 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through' 
                        : useNextAvailable
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-[#06b6d4]/10 hover:text-[#06b6d4]'
                  }
                `}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#06b6d4]"></span>
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></span>
          Unavailable
        </span>
        <span className="text-gray-400">Click dates to select multiple</span>
      </div>

      {/* Next Available Option */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
              useNextAvailable 
                ? 'bg-[#06b6d4] border-[#06b6d4]' 
                : 'border-gray-300 group-hover:border-[#06b6d4]'
            }`}
            onClick={onToggleNextAvailable}
          >
            {useNextAvailable && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1">
            <span className="font-medium text-gray-900">Use next available dates</span>
            <p className="text-sm text-gray-500">We'll schedule your ad for the next open slots</p>
            
            {/* Number of days input */}
            {useNextAvailable && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-gray-600">Number of days:</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onNextAvailableDaysChange(Math.max(1, nextAvailableDays - 1))}
                    className="w-8 h-8 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={nextAvailableDays}
                    onChange={(e) => onNextAvailableDaysChange(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                    className="w-16 h-8 border-y border-gray-300 text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => onNextAvailableDaysChange(Math.min(30, nextAvailableDays + 1))}
                    className="w-8 h-8 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Selected Dates Display */}
      {selectedDates.length > 0 && !useNextAvailable && (
        <div className="p-4 bg-[#06b6d4]/5 border border-[#06b6d4]/20 rounded-xl">
          <p className="text-sm font-medium text-gray-900 mb-2">
            Selected dates ({selectedDates.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDates.map(date => (
              <span 
                key={date.toISOString()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#06b6d4]/30 rounded-full text-sm"
              >
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <button
                  type="button"
                  onClick={() => removeDate(date)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {useNextAvailable && nextAvailableDays > 0 && (
        <div className="p-4 bg-[#06b6d4]/5 border border-[#06b6d4]/20 rounded-xl">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">Selected: </span>
            Next {nextAvailableDays} available {nextAvailableDays === 1 ? 'date' : 'dates'}
          </p>
        </div>
      )}
    </div>
  )
}
