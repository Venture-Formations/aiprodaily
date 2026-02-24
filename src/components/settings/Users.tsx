'use client'

export default function Users() {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">User Management</h3>

      <div className="text-gray-600 mb-4">
        User access is managed through Google OAuth. All users with valid Google accounts
        can access the system. Role-based permissions will be added in future versions.
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Current Access:</h4>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• All team members can review and modify newsletters</li>
          <li>• Authentication handled via Google OAuth</li>
          <li>• User activity is logged for audit purposes</li>
        </ul>
      </div>
    </div>
  )
}
