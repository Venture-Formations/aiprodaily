'use client'

import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import RichTextEditor from '@/components/RichTextEditor'
import { useAdSubmitForm } from './useAdSubmitForm'

export default function SubmitAdPage() {
  const {
    loading,
    selectedImage,
    crop,
    setCrop,
    setCompletedCrop,
    fileInputRef,
    imgRef,
    formData,
    setFormData,
    handleImageSelect,
    handleSubmit
  } = useAdSubmitForm()

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Submit Your Advertorial
          </h1>
          <p className="text-gray-600 mb-8">
            Get featured in the newsletter&apos;s Advertorial section.
            Your ad will reach thousands of subscribers! Submit your ad for review today.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Ad Content Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Advertisement Content</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ad Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., New Menu Items at Our Restaurant"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ad Content (Max 100 words) <span className="text-red-500">*</span>
                  </label>
                  <RichTextEditor
                    value={formData.body}
                    onChange={(html) => setFormData({ ...formData, body: html })}
                    maxWords={100}
                    placeholder="Write your advertisement content here. You can use bold, italic, underline, and add links."
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Advertisement Image (Optional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload an image to make your ad stand out! It will be cropped to 16:9 ratio.
                  </p>
                </div>

                {/* Image Cropper */}
                {selectedImage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Crop Image (16:9 ratio)
                    </label>
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={16 / 9}
                    >
                      <img
                        ref={imgRef}
                        src={selectedImage}
                        alt="Crop preview"
                        style={{ maxWidth: '100%' }}
                      />
                    </ReactCrop>
                  </div>
                )}
              </div>
            </div>

            {/* Button Information Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Call-to-Action Button</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Button Text <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Learn More, Visit Website, Get Started"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Button URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.button_url}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Ensure https:// prefix
                      if (!value.startsWith('http://') && !value.startsWith('https://')) {
                        value = 'https://' + value.replace(/^https?:\/\//, '');
                      }
                      setFormData({ ...formData, button_url: value });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Your Contact Information</h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.submitter_email}
                    onChange={(e) => setFormData({ ...formData, submitter_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your.email@example.com"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We&apos;ll use this email to notify you about your ad&apos;s status
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Advertorial for Review'}
              </button>
            </div>
          </form>
        </div>

        {/* Information Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Fill out the form above with your advertorial content and call-to-action button</li>
            <li>Submit your ad for review - no payment required at this time</li>
            <li>Our team will review your submission (typically within 1 business day)</li>
            <li>Once approved, your ad will be added to the rotation queue</li>
            <li>Your ad will appear in upcoming newsletters with a centered button linking to your destination</li>
            <li>You&apos;ll receive notifications via email about your ad&apos;s status</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
