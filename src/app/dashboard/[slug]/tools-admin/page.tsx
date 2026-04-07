'use client'

import Link from 'next/link'
import { Settings, Package, Users, BarChart3 } from 'lucide-react'
import Layout from '@/components/Layout'
import type { StatusFilter } from './types'
import { useToolsAdmin } from './useToolsAdmin'
import ToolCard from './ToolCard'
import EditToolModal from './EditToolModal'

const FILTER_OPTIONS: StatusFilter[] = ['pending', 'approved', 'rejected', 'all']

export default function ToolsAdminPage() {
  const {
    tools,
    categories,
    filter,
    loading,
    actionLoading,
    rejectReason,
    rejectingId,
    editingTool,
    setFilter,
    setRejectReason,
    setRejectingId,
    setEditingTool,
    fetchTools,
    handleApprove,
    handleReject,
    handleDelete,
  } = useToolsAdmin()

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tools Directory Admin</h1>
            <p className="text-gray-600 mt-1">Review and manage tool submissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="tools-admin/analytics"
              className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Link>
            <Link
              href="tools-admin/packages"
              className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <Package className="w-4 h-4 mr-2" />
              Packages
            </Link>
            <Link
              href="tools-admin/entitlements"
              className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Users className="w-4 h-4 mr-2" />
              Entitlements
            </Link>
            <Link
              href="tools-admin/settings"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Tools List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading tools...</p>
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No {filter === 'all' ? '' : filter} tools found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                actionLoading={actionLoading}
                rejectingId={rejectingId}
                rejectReason={rejectReason}
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={handleDelete}
                onEdit={setEditingTool}
                onStartReject={setRejectingId}
                onCancelReject={() => {
                  setRejectingId(null)
                  setRejectReason('')
                }}
                onRejectReasonChange={setRejectReason}
              />
            ))}
          </div>
        )}

        {/* Edit Tool Modal */}
        {editingTool && (
          <EditToolModal
            key={editingTool.id}
            tool={editingTool}
            categories={categories}
            onClose={() => setEditingTool(null)}
            onSuccess={() => {
              setEditingTool(null)
              fetchTools()
            }}
          />
        )}
      </div>
    </Layout>
  )
}
