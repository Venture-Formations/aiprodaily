'use client'

import { Pencil, Check, X } from 'lucide-react'
import type { Defaults } from './types'

interface DefaultsEditorProps {
  defaults: Defaults
  editingDefaultCr: boolean
  setEditingDefaultCr: (v: boolean) => void
  defaultCrInput: string
  setDefaultCrInput: (v: string) => void
  editingDefaultRcr: boolean
  setEditingDefaultRcr: (v: boolean) => void
  defaultRcrInput: string
  setDefaultRcrInput: (v: string) => void
  editingDefaultMcb: boolean
  setEditingDefaultMcb: (v: boolean) => void
  defaultMcbInput: string
  setDefaultMcbInput: (v: string) => void
  defaultSaving: boolean
  saveDefault: (field: 'cr' | 'rcr' | 'mcb') => void
}

export function DefaultsEditor({
  defaults,
  editingDefaultCr,
  setEditingDefaultCr,
  defaultCrInput,
  setDefaultCrInput,
  editingDefaultRcr,
  setEditingDefaultRcr,
  defaultRcrInput,
  setDefaultRcrInput,
  editingDefaultMcb,
  setEditingDefaultMcb,
  defaultMcbInput,
  setDefaultMcbInput,
  defaultSaving,
  saveDefault,
}: DefaultsEditorProps) {
  return (
    <div className="flex items-center justify-end gap-4 mb-4">
      {/* Default CR */}
      <InlineEditor
        label="Default CR"
        suffix="%"
        currentValue={`${defaults.cr}%`}
        editing={editingDefaultCr}
        inputValue={defaultCrInput}
        saving={defaultSaving}
        inputProps={{ type: 'number', step: '0.1', min: '0', max: '100' }}
        onEdit={() => { setDefaultCrInput(String(defaults.cr)); setEditingDefaultCr(true) }}
        onCancel={() => setEditingDefaultCr(false)}
        onChange={setDefaultCrInput}
        onSave={() => saveDefault('cr')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveDefault('cr')
          if (e.key === 'Escape') setEditingDefaultCr(false)
        }}
      />

      {/* Default RCR */}
      <InlineEditor
        label="Default RCR"
        suffix="%"
        currentValue={`${defaults.rcr}%`}
        editing={editingDefaultRcr}
        inputValue={defaultRcrInput}
        saving={defaultSaving}
        inputProps={{ type: 'number', step: '0.1', min: '0', max: '100' }}
        onEdit={() => { setDefaultRcrInput(String(defaults.rcr)); setEditingDefaultRcr(true) }}
        onCancel={() => setEditingDefaultRcr(false)}
        onChange={setDefaultRcrInput}
        onSave={() => saveDefault('rcr')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveDefault('rcr')
          if (e.key === 'Escape') setEditingDefaultRcr(false)
        }}
      />

      {/* Min Conv Budget */}
      <InlineEditor
        label="Min. Conv. Budget"
        currentValue={String(defaults.minConversionsBudget)}
        editing={editingDefaultMcb}
        inputValue={defaultMcbInput}
        saving={defaultSaving}
        inputProps={{ type: 'number', step: '1', min: '1', max: '100' }}
        onEdit={() => { setDefaultMcbInput(String(defaults.minConversionsBudget)); setEditingDefaultMcb(true) }}
        onCancel={() => setEditingDefaultMcb(false)}
        onChange={setDefaultMcbInput}
        onSave={() => saveDefault('mcb')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveDefault('mcb')
          if (e.key === 'Escape') setEditingDefaultMcb(false)
        }}
        editTitle="Edit min conversions budget"
      />
    </div>
  )
}

function InlineEditor({
  label,
  suffix,
  currentValue,
  editing,
  inputValue,
  saving,
  inputProps,
  onEdit,
  onCancel,
  onChange,
  onSave,
  onKeyDown,
  editTitle,
}: {
  label: string
  suffix?: string
  currentValue: string
  editing: boolean
  inputValue: string
  saving: boolean
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
  onEdit: () => void
  onCancel: () => void
  onChange: (v: string) => void
  onSave: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  editTitle?: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-gray-500">{label}:</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            {...inputProps}
            value={inputValue}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            className="w-16 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          {suffix && <span className="text-gray-400">{suffix}</span>}
          <button
            onClick={onSave}
            disabled={saving}
            className="p-0.5 rounded text-green-600 hover:bg-green-100 disabled:opacity-50"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="font-medium">{currentValue}</span>
          <button
            onClick={onEdit}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title={editTitle || `Edit ${label.toLowerCase()}`}
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
