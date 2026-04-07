import type { TextBoxModule, TextBoxBlock } from '@/types/database'

export interface TextBoxModuleSettingsProps {
  module: TextBoxModule
  publicationId: string
  onUpdate: (updates: Partial<TextBoxModule>) => Promise<void>
  onDelete: () => Promise<void>
}

export interface TestResult {
  result?: string
  injectedPrompt?: string
  error?: string
}

export interface BlockEditorProps {
  block: TextBoxBlock
  isEditing: boolean
  saving: boolean
  onStartEdit: (block: TextBoxBlock) => void
  onCancelEdit: () => void
  onSaveBlock: (block: TextBoxBlock) => void
}

export interface StaticTextEditorProps extends BlockEditorProps {
  editContent: string
  setEditContent: (val: string) => void
  editTextSize: 'small' | 'medium' | 'large'
  setEditTextSize: (val: 'small' | 'medium' | 'large') => void
}

export interface AIPromptEditorProps extends BlockEditorProps {
  editPrompt: string
  setEditPrompt: (val: string) => void
  editTiming: 'before_articles' | 'after_articles'
  setEditTiming: (val: 'before_articles' | 'after_articles') => void
  editIsBold: boolean
  setEditIsBold: (val: boolean) => void
  editIsItalic: boolean
  setEditIsItalic: (val: boolean) => void
  editResponseField: string
  setEditResponseField: (val: string) => void
  testingPrompt: boolean
  testResult: TestResult | null
  onTestPrompt: () => void
}

export interface ImageEditorProps extends BlockEditorProps {
  editImageType: 'static' | 'ai_generated'
  setEditImageType: (val: 'static' | 'ai_generated') => void
  editAiImagePrompt: string
  setEditAiImagePrompt: (val: string) => void
  editImageAlt: string
  setEditImageAlt: (val: string) => void
  selectedImage: string | null
  crop: import('react-image-crop').Crop | undefined
  setCrop: (val: import('react-image-crop').Crop | undefined) => void
  completedCrop: import('react-image-crop').PixelCrop | undefined
  setCompletedCrop: (val: import('react-image-crop').PixelCrop | undefined) => void
  uploadingImage: boolean
  aspectRatio: '16:9' | '5:4' | 'free'
  onAspectRatioChange: (val: '16:9' | '5:4' | 'free') => void
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
}

// Quill toolbar configuration
export const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    [{ 'color': [] }]
  ],
}

export const quillFormats = [
  'bold', 'italic', 'underline',
  'list',
  'link',
  'color'
]

// Helper to detect AI provider from prompt JSON
export function detectProviderFromPrompt(promptJson: any): 'claude' | 'openai' {
  if (!promptJson) return 'openai'
  const str = JSON.stringify(promptJson).toLowerCase()
  if (str.includes('claude') || str.includes('anthropic')) return 'claude'
  return 'openai'
}


export function getTextSizeLabel(size: string): string {
  switch (size) {
    case 'small': return 'Small (14px)'
    case 'medium': return 'Medium (16px)'
    case 'large': return 'Large (20px, semibold)'
    default: return 'Medium'
  }
}

export function getAspectRatioValue(ratio: '16:9' | '5:4' | 'free'): number | undefined {
  switch (ratio) {
    case '16:9': return 16 / 9
    case '5:4': return 5 / 4
    case 'free': return undefined
  }
}
