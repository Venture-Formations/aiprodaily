import type { AIApplication, AIAppModule } from '@/types/database'

export const CATEGORIES = [
  'Accounting & Bookkeeping',
  'Tax & Compliance',
  'Payroll',
  'Finance & Analysis',
  'Expense Management',
  'Client Management',
  'Productivity',
  'HR',
  'Banking & Payments'
] as const

export const TOOL_TYPES = ['Client', 'Firm'] as const

export const EMPTY_ADD_FORM: Partial<AIApplication> = {
  app_name: '',
  description: '',
  category: null,
  app_url: '',
  tool_type: null,
  category_priority: 0,
  is_active: true,
  is_featured: false,
  is_paid_placement: false,
  is_affiliate: false,
  ai_app_module_id: null
}

export interface UseAIAppsDatabaseReturn {
  // Data
  apps: AIApplication[]
  modules: AIAppModule[]
  filteredApps: AIApplication[]
  loading: boolean
  publicationId: string | null

  // Edit state
  editingId: string | null
  editForm: Partial<AIApplication>
  handleEdit: (app: AIApplication) => void
  handleCancelEdit: () => void
  handleSave: (id: string) => Promise<void>
  handleDelete: (id: string, appName: string) => Promise<void>
  setEditForm: React.Dispatch<React.SetStateAction<Partial<AIApplication>>>

  // Add state
  showAddForm: boolean
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>
  addForm: Partial<AIApplication>
  setAddForm: React.Dispatch<React.SetStateAction<Partial<AIApplication>>>
  handleAddApp: () => Promise<void>

  // Filters
  filterCategory: string
  setFilterCategory: React.Dispatch<React.SetStateAction<string>>
  filterAffiliate: string
  setFilterAffiliate: React.Dispatch<React.SetStateAction<string>>
  filterModule: string
  setFilterModule: React.Dispatch<React.SetStateAction<string>>
  searchQuery: string
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>

  // CSV Upload
  uploadingCSV: boolean
  uploadMessage: string
  showUploadModal: boolean
  setShowUploadModal: React.Dispatch<React.SetStateAction<boolean>>
  uploadModuleId: string | null
  setUploadModuleId: React.Dispatch<React.SetStateAction<string | null>>
  handleCSVUpload: (file: File) => Promise<void>
  downloadTemplate: () => void

  // Helpers
  getModuleName: (moduleId: string | null) => string | null
}
