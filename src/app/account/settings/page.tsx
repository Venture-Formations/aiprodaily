import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { User, Bell, Shield, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account preferences
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Profile Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Profile</h2>
              <p className="text-sm text-gray-500">Manage your personal information</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-12 h-12"
                  }
                }}
              />
              <div>
                <p className="font-medium text-gray-900">{user.fullName || 'User'}</p>
                <p className="text-sm text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
            <a
              href="https://accounts.clerk.dev/user"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Manage Account
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Your account is managed through Clerk. Click "Manage Account" to update your password, email, or connected accounts.
          </p>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">Control what emails you receive</p>
            </div>
          </div>

          <div className="space-y-4">
            <NotificationToggle
              title="Ad Status Updates"
              description="Get notified when your ad status changes"
              defaultChecked={true}
            />
            <NotificationToggle
              title="Profile Updates"
              description="Get notified when your profile is approved or needs changes"
              defaultChecked={true}
            />
            <NotificationToggle
              title="Marketing & Tips"
              description="Receive tips on how to improve your listings"
              defaultChecked={false}
            />
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Security</h2>
              <p className="text-sm text-gray-500">Protect your account</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              Security settings including password, two-factor authentication, and connected accounts are managed through your Clerk account.
            </p>
            <a
              href="https://accounts.clerk.dev/user/security"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-sm text-[#06b6d4] hover:underline"
            >
              Manage Security Settings
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Client component for toggles
function NotificationToggle({ 
  title, 
  description, 
  defaultChecked 
}: { 
  title: string
  description: string
  defaultChecked: boolean 
}) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-gray-100 first:border-t-0 first:pt-0">
      <div>
        <p className="font-medium text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          defaultChecked={defaultChecked}
          className="sr-only peer" 
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#06b6d4]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#06b6d4]"></div>
      </label>
    </div>
  )
}

