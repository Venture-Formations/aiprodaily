'use client'

import type { AIAppModule } from '@/types/database'

interface UploadModalProps {
  modules: AIAppModule[]
  uploadModuleId: string | null
  setUploadModuleId: (id: string | null) => void
  onClose: () => void
  onUpload: (file: File) => void
  downloadTemplate: () => void
}

export function UploadModal({
  modules,
  uploadModuleId,
  setUploadModuleId,
  onClose,
  onUpload,
  downloadTemplate
}: UploadModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Upload AI Applications CSV</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              x
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Required CSV Columns</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-semibold text-gray-700">Column Name</div>
                <div className="font-semibold text-gray-700">Required</div>
                <div className="font-semibold text-gray-700">Description</div>
              </div>
              <hr className="border-gray-300" />

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium text-gray-900">Tool Name</div>
                <div className="text-red-600 font-semibold">Required</div>
                <div className="text-gray-600">Name of the AI application</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium text-gray-900">Category</div>
                <div className="text-blue-600">Optional</div>
                <div className="text-gray-600">Must be one of: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium text-gray-900">Tool Type</div>
                <div className="text-blue-600">Optional</div>
                <div className="text-gray-600">Must be: Client or Firm (defaults to Client)</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium text-gray-900">Link</div>
                <div className="text-red-600 font-semibold">Required</div>
                <div className="text-gray-600">URL to the application website</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium text-gray-900">Description</div>
                <div className="text-red-600 font-semibold">Required</div>
                <div className="text-gray-600">Brief description (max 200 characters)</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium text-gray-900">Affiliate</div>
                <div className="text-blue-600">Optional</div>
                <div className="text-gray-600">Enter &quot;yes&quot;, &quot;true&quot;, or &quot;1&quot; for affiliate programs</div>
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Tips:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Column names are case-insensitive</li>
              <li>Use quotes around values containing commas</li>
              <li>Download the template below for correct formatting</li>
              <li>All new apps will be set to Active by default</li>
              <li><strong>Duplicate handling:</strong> Apps with matching names will be updated (not duplicated)</li>
            </ul>
          </div>

          {/* Module Assignment Dropdown */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Assign Imported Products to Section (Optional)
            </label>
            <select
              value={uploadModuleId || ''}
              onChange={(e) => setUploadModuleId(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Don&apos;t assign to any section (shared)</option>
              {modules.map(mod => (
                <option key={mod.id} value={mod.id}>{mod.name}</option>
              ))}
            </select>
            <p className="text-sm text-gray-600 mt-2">
              Products without a mod assignment will be assigned to the selected section.
              Leave as &quot;Don&apos;t assign&quot; to keep them shared across all sections.
            </p>
          </div>

          <div className="flex justify-between items-center gap-4">
            <button
              onClick={downloadTemplate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Download Template CSV
            </button>

            <label className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium cursor-pointer text-center">
              Choose CSV File to Upload
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUpload(file)
                  e.target.value = ''
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
