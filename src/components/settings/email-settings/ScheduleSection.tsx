'use client'

import { TimePicker } from './TimePicker'

interface TimeField {
  label: string
  field: string
  hint: string
}

interface ScheduleSectionProps {
  title: string
  description: string
  enabled: boolean
  enabledField: string
  timeFields: TimeField[]
  settings: Record<string, any>
  onChange: (field: string, value: string | boolean | number[]) => void
  workflowTitle: string
  workflowColor: 'blue' | 'green' | 'purple'
  workflowSteps: string[]
  children?: React.ReactNode
}

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-900', text: 'text-blue-800' },
  green: { bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-900', text: 'text-green-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-900', text: 'text-purple-800' },
}

export function ScheduleSection({
  title,
  description,
  enabled,
  enabledField,
  timeFields,
  settings,
  onChange,
  workflowTitle,
  workflowColor,
  workflowSteps,
  children,
}: ScheduleSectionProps) {
  const colors = COLOR_MAP[workflowColor]

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onChange(enabledField, e.target.checked)}
              className="sr-only"
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-brand-primary' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
            <span className="ml-3 text-sm font-medium text-gray-700">
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {timeFields.map((tf) => (
          <div key={tf.field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tf.label}</label>
            <TimePicker
              value={settings[tf.field] || '00:00'}
              onChange={(v) => onChange(tf.field, v)}
              disabled={!enabled}
            />
            <p className="text-xs text-gray-500 mt-1">{tf.hint}</p>
          </div>
        ))}
      </div>

      {children}

      <div className={`mt-4 p-4 ${colors.bg} border ${colors.border} rounded-lg`}>
        <h4 className={`font-medium ${colors.title} mb-2`}>{workflowTitle}</h4>
        <div className={`text-sm ${colors.text} space-y-1`}>
          {workflowSteps.map((step, i) => (
            <div key={i}>{i + 1}. {step}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
