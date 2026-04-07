'use client'

import type { AIApplication, AIAppModule } from '@/types/database'
import { CATEGORIES, TOOL_TYPES } from './types'

interface AppsTableProps {
  filteredApps: AIApplication[]
  editingId: string | null
  editForm: Partial<AIApplication>
  setEditForm: React.Dispatch<React.SetStateAction<Partial<AIApplication>>>
  modules: AIAppModule[]
  onEdit: (app: AIApplication) => void
  onCancelEdit: () => void
  onSave: (id: string) => void
  onDelete: (id: string, appName: string) => void
  getModuleName: (moduleId: string | null) => string | null
}

export function AppsTable({
  filteredApps,
  editingId,
  editForm,
  setEditForm,
  modules,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  getModuleName
}: AppsTableProps) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Application
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tool Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Module
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pinned
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredApps.map((app) => (
            <tr key={app.id} className={!app.is_active ? 'bg-gray-50' : ''}>
              {editingId === app.id ? (
                <EditRow
                  app={app}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  modules={modules}
                  onSave={onSave}
                  onCancel={onCancelEdit}
                />
              ) : (
                <DisplayRow
                  app={app}
                  getModuleName={getModuleName}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {filteredApps.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No product cards found. Click &quot;Add Product&quot; to get started.
        </div>
      )}
    </div>
  )
}

// ---- Edit Row ----

interface EditRowProps {
  app: AIApplication
  editForm: Partial<AIApplication>
  setEditForm: React.Dispatch<React.SetStateAction<Partial<AIApplication>>>
  modules: AIAppModule[]
  onSave: (id: string) => void
  onCancel: () => void
}

function EditRow({ app, editForm, setEditForm, modules, onSave, onCancel }: EditRowProps) {
  return (
    <>
      <td className="px-6 py-4">
        <input
          type="text"
          value={editForm.app_name || ''}
          onChange={(e) => setEditForm({ ...editForm, app_name: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="App Name"
        />
        <input
          type="url"
          value={editForm.app_url || ''}
          onChange={(e) => setEditForm({ ...editForm, app_url: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-1"
          placeholder="App URL"
        />
      </td>
      <td className="px-6 py-4">
        <textarea
          value={editForm.description || ''}
          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          rows={3}
        />
      </td>
      <td className="px-6 py-4">
        <select
          value={editForm.category || ''}
          onChange={(e) => setEditForm({ ...editForm, category: e.target.value || null as any })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="">-- None --</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4">
        <select
          value={editForm.tool_type || ''}
          onChange={(e) => setEditForm({ ...editForm, tool_type: e.target.value || null as any })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="">-- None --</option>
          {TOOL_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4">
        <select
          value={editForm.ai_app_module_id || ''}
          onChange={(e) => setEditForm({
            ...editForm,
            ai_app_module_id: e.target.value || null,
            pinned_position: e.target.value ? editForm.pinned_position : null
          })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="">All (shared)</option>
          {modules.map(mod => (
            <option key={mod.id} value={mod.id}>{mod.name}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4">
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={editForm.is_active}
            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
            className="mr-1"
          />
          Active
        </label>
        <label className="flex items-center text-sm mt-1">
          <input
            type="checkbox"
            checked={editForm.is_featured}
            onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
            className="mr-1"
          />
          Featured
        </label>
        <label className="flex items-center text-sm mt-1">
          <input
            type="checkbox"
            checked={editForm.is_paid_placement}
            onChange={(e) => setEditForm({ ...editForm, is_paid_placement: e.target.checked })}
            className="mr-1"
          />
          Paid Placement
        </label>
        <label className="flex items-center text-sm mt-1">
          <input
            type="checkbox"
            checked={editForm.is_affiliate}
            onChange={(e) => setEditForm({ ...editForm, is_affiliate: e.target.checked })}
            className="mr-1"
          />
          Affiliate
        </label>
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          min="1"
          max="20"
          value={editForm.pinned_position || ''}
          onChange={(e) => setEditForm({
            ...editForm,
            pinned_position: e.target.value ? parseInt(e.target.value) : null
          })}
          disabled={!editForm.ai_app_module_id}
          placeholder={editForm.ai_app_module_id ? "Not pinned" : "N/A"}
          className={`w-20 border border-gray-300 rounded px-2 py-1 text-sm ${!editForm.ai_app_module_id ? 'bg-gray-100 text-gray-400' : ''}`}
        />
        <p className="text-xs text-gray-500 mt-1">
          {editForm.ai_app_module_id ? '1-20' : 'Needs mod'}
        </p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <button
          onClick={() => onSave(app.id)}
          className="text-green-600 hover:text-green-900 mr-3"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </td>
    </>
  )
}

// ---- Display Row ----

interface DisplayRowProps {
  app: AIApplication
  getModuleName: (moduleId: string | null) => string | null
  onEdit: (app: AIApplication) => void
  onDelete: (id: string, appName: string) => void
}

function DisplayRow({ app, getModuleName, onEdit, onDelete }: DisplayRowProps) {
  return (
    <>
      <td className="px-6 py-4">
        <div className="flex items-center">
          {app.logo_url && (
            <img
              src={app.logo_url}
              alt={app.app_name}
              className="w-10 h-10 rounded mr-3"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{app.app_name}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
        {app.description}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        {app.category}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          {app.tool_type || 'Client'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {app.ai_app_module_id ? (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
            {getModuleName(app.ai_app_module_id)}
          </span>
        ) : (
          <span className="text-gray-400">All (shared)</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {app.is_active ? (
          <span className="text-green-600">Active</span>
        ) : (
          <span className="text-gray-400">Inactive</span>
        )}
        {app.is_featured && (
          <span className="block text-amber-600 text-xs">Featured</span>
        )}
        {app.is_paid_placement && (
          <span className="block text-cyan-600 text-xs">Paid Placement</span>
        )}
        {app.is_affiliate && (
          <span className="block text-blue-600 text-xs font-semibold">$ Affiliate</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {app.pinned_position && app.ai_app_module_id ? (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
            #{app.pinned_position}
          </span>
        ) : app.ai_app_module_id ? (
          <span className="text-gray-400">-</span>
        ) : (
          <span className="text-gray-300 text-xs">N/A</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <button
          onClick={() => onEdit(app)}
          className="text-blue-600 hover:text-blue-900 mr-3"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(app.id, app.app_name)}
          className="text-red-600 hover:text-red-900"
        >
          Delete
        </button>
      </td>
    </>
  )
}
