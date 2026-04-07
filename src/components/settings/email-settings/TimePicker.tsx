'use client'

const SELECT_STYLE = {
  backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
  backgroundPosition: "right 0.5rem center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "1.5em 1.5em",
}

const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

interface TimePickerProps {
  value: string  // "HH:MM" in 24h format
  onChange: (value: string) => void
  disabled?: boolean
}

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const hour24 = parseInt(value.split(':')[0])
  const minutes = value.split(':')[1] || '00'
  const isAM = hour24 < 12
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24

  const handleHourChange = (newHour12: number) => {
    let h24: number
    if (newHour12 === 12) {
      h24 = isAM ? 0 : 12
    } else {
      h24 = isAM ? newHour12 : newHour12 + 12
    }
    onChange(`${h24.toString().padStart(2, '0')}:${minutes}`)
  }

  const handleMinuteChange = (newMinutes: string) => {
    onChange(`${hour24.toString().padStart(2, '0')}:${newMinutes}`)
  }

  const handleAmPmChange = (ampm: string) => {
    const currentHour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
    let h24: number
    if (ampm === 'AM') {
      h24 = currentHour12 === 12 ? 0 : currentHour12
    } else {
      h24 = currentHour12 === 12 ? 12 : currentHour12 + 12
    }
    onChange(`${h24.toString().padStart(2, '0')}:${minutes}`)
  }

  const selectClass = "w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"

  return (
    <div className="flex space-x-2 items-center">
      <select
        value={hour12.toString()}
        onChange={(e) => handleHourChange(parseInt(e.target.value))}
        disabled={disabled}
        className={selectClass}
        style={SELECT_STYLE}
      >
        {Array.from({ length: 12 }, (_, i) => {
          const hour = i + 1
          return <option key={hour} value={hour.toString()}>{hour}</option>
        })}
      </select>
      <span>:</span>
      <select
        value={minutes}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
        style={SELECT_STYLE}
      >
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select
        value={isAM ? 'AM' : 'PM'}
        onChange={(e) => handleAmPmChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
        style={SELECT_STYLE}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
