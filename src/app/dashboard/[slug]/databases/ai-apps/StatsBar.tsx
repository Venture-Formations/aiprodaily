'use client'

import type { AIApplication } from '@/types/database'

interface StatsBarProps {
  apps: AIApplication[]
}

export function StatsBar({ apps }: StatsBarProps) {
  return (
    <div className="mb-6 grid grid-cols-2 md:grid-cols-6 gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-blue-600">{apps.length}</div>
        <div className="text-sm text-gray-600">Total Products</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-green-600">
          {apps.filter(a => a.is_active).length}
        </div>
        <div className="text-sm text-gray-600">Active</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-yellow-600">
          {apps.filter(a => a.is_affiliate).length}
        </div>
        <div className="text-sm text-gray-600">Affiliates</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-amber-600">
          {apps.filter(a => a.is_featured).length}
        </div>
        <div className="text-sm text-gray-600">Featured</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-cyan-600">
          {apps.filter(a => a.is_paid_placement).length}
        </div>
        <div className="text-sm text-gray-600">Paid Placement</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold text-purple-600">
          {new Set(apps.map(a => a.category)).size}
        </div>
        <div className="text-sm text-gray-600">Categories</div>
      </div>
    </div>
  )
}
