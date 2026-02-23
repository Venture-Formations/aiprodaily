'use client'

import { useEffect, useState } from 'react'
import type { Advertisement } from '@/types/database'

interface AdPreviewModalProps {
  ad: Advertisement
  onClose: () => void
}

// Ad Preview Modal Component - Shows how the ad will look in the newsletter
export default function AdPreviewModal({ ad, onClose }: AdPreviewModalProps) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Generate the preview HTML
    generatePreview()
  }, [ad])

  const generatePreview = async () => {
    setLoading(true)
    try {
      // Fetch the preview from the API
      const response = await fetch(`/api/ads/${ad.id}/preview`)
      if (response.ok) {
        const data = await response.json()
        setPreviewHtml(data.html)
      } else {
        throw new Error('Failed to generate preview')
      }
    } catch (error) {
      console.error('Preview generation error:', error)
      // Fallback: generate a simple client-side preview
      setPreviewHtml(generateClientSidePreview(ad))
    } finally {
      setLoading(false)
    }
  }

  // Fallback client-side preview generation
  const generateClientSidePreview = (ad: Advertisement): string => {
    const primaryColor = '#1877F2'
    const headingFont = 'Arial, sans-serif'
    const bodyFont = 'Arial, sans-serif'
    const buttonUrl = ad.button_url || '#'

    // Process ad body: make the last sentence a hyperlink
    let processedBody = ad.body || ''
    if (buttonUrl !== '#' && processedBody) {
      const plainText = processedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
      const matches = Array.from(plainText.matchAll(sentenceEndPattern))

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1] as RegExpMatchArray
        const lastPeriodIndex = lastMatch.index!
        let startIndex = 0
        if (matches.length > 1) {
          const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
          startIndex = secondLastMatch.index! + 1
        }
        const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()
        if (lastSentence.length > 5) {
          const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const parts = escapedSentence.split(/\s+/)
          const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
          const sentenceRegex = new RegExp(flexiblePattern, 'i')
          processedBody = processedBody.replace(
            sentenceRegex,
            `<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
          )
        }
      }
    }

    const imageHtml = ad.image_url
      ? `<tr><td style='padding: 0 12px; text-align: center;'><a href='${buttonUrl}'><img src='${ad.image_url}' alt='${ad.title}' style='max-width: 100%; max-height: 500px; border-radius: 4px; display: block; margin: 0 auto;'></a></td></tr>`
      : ''

    return `
      <html>
      <head>
        <style>
          body { margin: 0; padding: 20px; background-color: #f7f7f7; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
          <tr>
            <td style="padding:0 10px;">
              <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 10px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
                <tr>
                  <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
                    <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Advertorial</h2>
                  </td>
                </tr>
                <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold; text-align: left;'>${ad.title}</td></tr>
                ${imageHtml}
                <tr><td style='padding: 0 10px 10px; font-family: ${bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>${processedBody}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Ad Preview - {ad.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full min-h-[500px]"
              title="Ad Preview"
              style={{ border: 'none' }}
            />
          ) : (
            <div className="flex justify-center items-center h-64 text-gray-500">
              Failed to generate preview
            </div>
          )}
        </div>
        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
