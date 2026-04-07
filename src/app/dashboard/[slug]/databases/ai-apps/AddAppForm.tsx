'use client'

import type { AIApplication, AIAppModule } from '@/types/database'
import { CATEGORIES, TOOL_TYPES } from './types'

interface AddAppFormProps {
  addForm: Partial<AIApplication>
  setAddForm: React.Dispatch<React.SetStateAction<Partial<AIApplication>>>
  modules: AIAppModule[]
  onSubmit: () => void
  onCancel: () => void
}

export function AddAppForm({ addForm, setAddForm, modules, onSubmit, onCancel }: AddAppFormProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-500">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Add New AI Application</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            App Name *
          </label>
          <input
            type="text"
            value={addForm.app_name || ''}
            onChange={(e) => setAddForm({ ...addForm, app_name: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="QuickBooks AI Assistant"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description * (max 200 characters)
          </label>
          <textarea
            value={addForm.description || ''}
            onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            maxLength={200}
            placeholder="AI-powered accounting assistant that categorizes transactions..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={addForm.category || ''}
            onChange={(e) => setAddForm({ ...addForm, category: e.target.value || null as any })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">-- Select Category --</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tool Type
          </label>
          <select
            value={addForm.tool_type || ''}
            onChange={(e) => setAddForm({ ...addForm, tool_type: e.target.value || null as any })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">-- Select Type --</option>
            {TOOL_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            App URL *
          </label>
          <input
            type="url"
            value={addForm.app_url || ''}
            onChange={(e) => setAddForm({ ...addForm, app_url: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logo URL (optional)
          </label>
          <input
            type="url"
            value={addForm.logo_url || ''}
            onChange={(e) => setAddForm({ ...addForm, logo_url: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://example.com/logo.png"
          />
        </div>
        {addForm.logo_url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo Alt Text
            </label>
            <input
              type="text"
              maxLength={200}
              value={addForm.logo_alt || ''}
              onChange={(e) => setAddForm({ ...addForm, logo_alt: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Brief logo description (max 200 chars)"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign to Module
          </label>
          <select
            value={addForm.ai_app_module_id || ''}
            onChange={(e) => setAddForm({
              ...addForm,
              ai_app_module_id: e.target.value || null,
              pinned_position: e.target.value ? addForm.pinned_position : null
            })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">All Modules (shared)</option>
            {modules.map(mod => (
              <option key={mod.id} value={mod.id}>{mod.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Leave as &quot;All Modules&quot; to share across all Product Card sections</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pinned Position {!addForm.ai_app_module_id && <span className="text-gray-400 font-normal">(requires mod)</span>}
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={addForm.pinned_position || ''}
            onChange={(e) => setAddForm({
              ...addForm,
              pinned_position: e.target.value ? parseInt(e.target.value) : null
            })}
            disabled={!addForm.ai_app_module_id}
            placeholder={addForm.ai_app_module_id ? "Not pinned" : "Select mod first"}
            className={`w-full border border-gray-300 rounded px-3 py-2 ${!addForm.ai_app_module_id ? 'bg-gray-100 text-gray-400' : ''}`}
          />
          <p className="text-xs text-gray-500 mt-1">Pin to position 1-20 within the selected mod</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={addForm.is_active}
              onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={addForm.is_featured}
              onChange={(e) => setAddForm({ ...addForm, is_featured: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Featured</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={addForm.is_paid_placement}
              onChange={(e) => setAddForm({ ...addForm, is_paid_placement: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Paid Placement</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={addForm.is_affiliate}
              onChange={(e) => setAddForm({ ...addForm, is_affiliate: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Affiliate</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Add Application
        </button>
      </div>
    </div>
  )
}
