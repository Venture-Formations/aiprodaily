'use client'

import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { useAddAdModal } from './useAddAdModal'

interface AddAdModalProps {
  onClose: () => void
  onSuccess: () => void
  publicationId: string | null
  selectedSection: string
  sectionName: string
}

export default function AddAdModal({ onClose, onSuccess, publicationId, selectedSection, sectionName }: AddAdModalProps) {
  const {
    formData, setFormData, selectedImage, crop, setCrop,
    completedCrop, setCompletedCrop, fileInputRef, imgRef,
    submitting, advertisers, selectedAdvertiserId, setSelectedAdvertiserId,
    newCompanyName, setNewCompanyName, companyMode, setCompanyMode,
    handleImageSelect, handleSubmit,
  } = useAddAdModal(publicationId, selectedSection, onSuccess)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Add Advertisement - {sectionName}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Title *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Enter ad title" />
          </div>

          {/* Company/Advertiser */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company *</label>
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="companyMode" checked={companyMode === 'new'} onChange={() => setCompanyMode('new')} className="text-blue-600" />
                  <span className="text-sm text-gray-700">New Company</span>
                </label>
                {advertisers.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="companyMode" checked={companyMode === 'existing'} onChange={() => setCompanyMode('existing')} className="text-blue-600" />
                    <span className="text-sm text-gray-700">Existing Company</span>
                  </label>
                )}
              </div>
              {companyMode === 'new' && (
                <input type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Enter company name" />
              )}
              {companyMode === 'existing' && advertisers.length > 0 && (
                <select value={selectedAdvertiserId} onChange={(e) => setSelectedAdvertiserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">Select a company...</option>
                  {advertisers.map(adv => <option key={adv.id} value={adv.id}>{adv.company_name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Content *</label>
            <RichTextEditor value={formData.body} onChange={(html) => setFormData(prev => ({ ...prev, body: html }))} maxWords={10000} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action (Optional)</label>
            <input type="text" value={formData.cta_text} onChange={(e) => setFormData(prev => ({ ...prev, cta_text: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g. Try it free for 14 days" />
            <p className="text-xs text-gray-500 mt-1">Text that will be linked to the URL below. Leave blank to omit.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Advertisement Image (Optional)</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <p className="text-xs text-gray-500 mt-1">Upload an image for your ad. It will be cropped to 16:9 ratio.</p>
          </div>

          {selectedImage && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Crop Image (16:9 ratio)</label>
                <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={16 / 9}>
                  <img ref={imgRef} src={selectedImage} alt="Crop preview" style={{ maxWidth: '100%' }} />
                </ReactCrop>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image Alt Text</label>
                <input type="text" maxLength={200} value={formData.image_alt} onChange={(e) => setFormData(prev => ({ ...prev, image_alt: e.target.value }))} placeholder="Brief image description (max 200 chars)" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                <p className="text-xs text-gray-500 mt-1">Accessible description for the ad image.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
            <input type="text" required value={formData.button_url} onChange={(e) => {
              let value = e.target.value;
              if (!value.startsWith('http://') && !value.startsWith('https://')) {
                value = 'https://' + value.replace(/^https?:\/\//, '');
              }
              setFormData(prev => ({ ...prev, button_url: value }));
            }} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="https://example.com" />
            <p className="text-xs text-gray-500 mt-1">The image and Call to Action will link to this URL</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300" disabled={submitting}>Cancel</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Advertisement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
