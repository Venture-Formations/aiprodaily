'use client'

interface PreviewModalProps {
  previewHtml: string | null
  issueDate: string
  onClose: () => void
}

export default function PreviewModal({ previewHtml, issueDate, onClose }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Email Preview
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (previewHtml) {
                  const blob = new Blob([previewHtml], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `newsletter-${issueDate}.html`
                  a.click()
                  URL.revokeObjectURL(url)
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            >
              Download HTML
            </button>
            <button
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full min-h-[600px]"
              title="Email Preview"
            />
          )}
        </div>
      </div>
    </div>
  )
}
