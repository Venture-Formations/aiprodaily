'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { useManualArticles } from './useManualArticles'
import ArticleFormModal from './ArticleFormModal'
import ArticleTable from './ArticleTable'

export default function ManualArticlesPage() {
  const params = useParams()
  const slug = params?.slug as string || ''
  const hook = useManualArticles()

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header with breadcrumb */}
        <div className="mb-6">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href={`/dashboard/${slug}/databases`} className="text-gray-500 hover:text-gray-700">
                  Databases
                </Link>
              </li>
              <li>
                <span className="text-gray-500">/</span>
              </li>
              <li>
                <span className="text-gray-900 font-medium">Manual Articles</span>
              </li>
            </ol>
          </nav>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manual Articles</h1>
              <p className="text-gray-600 mt-1">
                {hook.articles.length} {hook.activeTab} {hook.articles.length === 1 ? 'article' : 'articles'}
              </p>
            </div>
            <button
              onClick={hook.openAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Article
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {(['draft', 'published', 'used'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => hook.setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  hook.activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {hook.loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
          </div>
        ) : hook.articles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No {hook.activeTab} articles found</p>
            <button
              onClick={hook.openAddModal}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Create your first article
            </button>
          </div>
        ) : (
          <ArticleTable
            articles={hook.articles}
            websiteDomain={hook.websiteDomain}
            onEdit={hook.openEditModal}
            onStatusChange={hook.handleStatusChange}
            onDelete={hook.handleDelete}
          />
        )}

        {/* Add/Edit Modal */}
        {hook.showAddModal && (
          <ArticleFormModal
            editingArticle={hook.editingArticle}
            formData={hook.formData}
            setFormData={hook.setFormData}
            categories={hook.categories}
            saving={hook.saving}
            uploadingImage={hook.uploadingImage}
            imageSrc={hook.imageSrc}
            crop={hook.crop}
            setCrop={hook.setCrop}
            completedCrop={hook.completedCrop}
            setCompletedCrop={hook.setCompletedCrop}
            imgRef={hook.imgRef}
            handleTitleChange={hook.handleTitleChange}
            handleSlugChange={hook.handleSlugChange}
            handleImageSelect={hook.handleImageSelect}
            onImageLoad={hook.onImageLoad}
            handleSave={hook.handleSave}
            closeModal={hook.closeModal}
            showCategoryModal={hook.showCategoryModal}
            setShowCategoryModal={hook.setShowCategoryModal}
            newCategoryName={hook.newCategoryName}
            setNewCategoryName={hook.setNewCategoryName}
            handleAddCategory={hook.handleAddCategory}
          />
        )}
      </div>
    </Layout>
  )
}
