'use client'

interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg'
}

interface ColumnSelectorProps {
  columns: Column[]
  onToggleColumn: (key: string) => void
}

export default function ColumnSelector({ columns, onToggleColumn }: ColumnSelectorProps) {
  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="text-xs font-semibold mb-2">Select Columns to Display</h3>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
        {columns.map(col => (
          <label key={col.key} className="flex items-center space-x-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={col.enabled}
              onChange={() => onToggleColumn(col.key)}
              className="rounded border-gray-300"
            />
            <span>{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
