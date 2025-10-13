/**
 * Shared utility for cropping images using react-image-crop
 * Used across advertisement submission and admin dashboard
 */

import { PixelCrop } from 'react-image-crop'

/**
 * Creates a cropped image blob from an image element and crop dimensions
 * @param imgElement - The HTMLImageElement to crop from
 * @param completedCrop - The pixel crop dimensions from react-image-crop
 * @param quality - JPEG quality (0-1), defaults to 0.9
 * @returns Promise resolving to the cropped image Blob or null
 */
export async function getCroppedImage(
  imgElement: HTMLImageElement | null,
  completedCrop: PixelCrop | undefined,
  quality: number = 0.9
): Promise<Blob | null> {
  if (!completedCrop || !imgElement) return null

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) return null

  // Calculate scale factors for natural vs displayed size
  const scaleX = imgElement.naturalWidth / imgElement.width
  const scaleY = imgElement.naturalHeight / imgElement.height

  // Set canvas dimensions to crop size
  canvas.width = completedCrop.width
  canvas.height = completedCrop.height

  // Draw the cropped portion
  ctx.drawImage(
    imgElement,
    completedCrop.x * scaleX,
    completedCrop.y * scaleY,
    completedCrop.width * scaleX,
    completedCrop.height * scaleY,
    0,
    0,
    completedCrop.width,
    completedCrop.height
  )

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      },
      'image/jpeg',
      quality
    )
  })
}
