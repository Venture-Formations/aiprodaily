'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface Venue {
  id: string
  name: string
  address: string
}

interface EventFormData {
  title: string
  description: string
  start_date: string
  start_hour: string
  start_minute: string
  start_ampm: string
  end_hour: string
  end_minute: string
  end_ampm: string
  venue_id: string
  venue_name: string
  venue_street: string
  venue_city: string
  venue_state: string
  venue_zip: string
  submitter_first_name: string
  submitter_last_name: string
  submitter_email: string
  submitter_phone: string
  url: string
  placement_type: 'none' | 'paid' | 'featured'
}

interface CartItem extends EventFormData {
  id: string
  original_image_url?: string
  cropped_image_url?: string
}

export default function SubmitEventPage() {
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [showAddVenue, setShowAddVenue] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [pricing, setPricing] = useState({ paidPlacement: 5, featured: 15 })

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    start_date: '',
    start_hour: '12',
    start_minute: '00',
    start_ampm: 'PM',
    end_hour: '12',
    end_minute: '00',
    end_ampm: 'PM',
    venue_id: '',
    venue_name: '',
    venue_street: '',
    venue_city: '',
    venue_state: 'MN',
    venue_zip: '',
    submitter_first_name: '',
    submitter_last_name: '',
    submitter_email: '',
    submitter_phone: '',
    url: '',
    placement_type: 'none'
  })

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    loadVenues()
    loadPricing()
    loadCart()
  }, [])

  const loadVenues = async () => {
    try {
      const response = await fetch('/api/events/venues')
      if (response.ok) {
        const data = await response.json()
        setVenues(data.venues || [])
      }
    } catch (error) {
      console.error('Failed to load venues:', error)
    }
  }

  const loadPricing = async () => {
    try {
      const response = await fetch('/api/settings/public-events')
      if (response.ok) {
        const data = await response.json()
        setPricing({
          paidPlacement: parseFloat(data.paidPlacementPrice),
          featured: parseFloat(data.featuredEventPrice)
        })
      }
    } catch (error) {
      console.error('Failed to load pricing:', error)
    }
  }

  const loadCart = () => {
    const savedCart = sessionStorage.getItem('eventCart')
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
  }

  const saveCart = (updatedCart: CartItem[]) => {
    sessionStorage.setItem('eventCart', JSON.stringify(updatedCart))
    setCart(updatedCart)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
      // Set initial crop to 5:4 aspect ratio
      setCrop({
        unit: '%',
        width: 80,
        height: 64, // 80 * (4/5) = 64
        x: 10,
        y: 18
      })
    }
    reader.readAsDataURL(file)
  }

  const handleVenueChange = (venueId: string) => {
    if (venueId === 'add-new') {
      setShowAddVenue(true)
      setFormData(prev => ({ ...prev, venue_id: '' }))
    } else {
      setShowAddVenue(false)
      const venue = venues.find(v => v.id === venueId)
      // Parse existing venue address (format: "street, city, state zip")
      const addressParts = venue?.address?.split(',') || []
      const street = addressParts[0]?.trim() || ''
      const cityStateZip = addressParts[1]?.trim() || ''
      const cityStateZipParts = cityStateZip.split(' ')
      const zip = cityStateZipParts.pop() || ''
      const state = cityStateZipParts.pop() || ''
      const city = cityStateZipParts.join(' ')

      setFormData(prev => ({
        ...prev,
        venue_id: venueId,
        venue_name: venue?.name || '',
        venue_street: street,
        venue_city: city,
        venue_state: state,
        venue_zip: zip
      }))
    }
  }

  const addToCart = async () => {
    // Validation
    if (!formData.title || !formData.description || !formData.start_date) {
      alert('Please fill in all required fields')
      return
    }

    if (!formData.venue_id && (!formData.venue_name || !formData.venue_street || !formData.venue_city || !formData.venue_state || !formData.venue_zip)) {
      alert('Please select a venue or complete all venue address fields')
      return
    }

    if (!selectedImage && formData.placement_type === 'featured') {
      alert('Image required for featured events')
      return
    }

    // Upload images if provided
    let original_image_url = ''
    let cropped_image_url = ''

    if (selectedImage && completedCrop) {
      setUploading(true)
      try {
        // Ensure we have valid crop dimensions
        if (!completedCrop.width || !completedCrop.height) {
          throw new Error('Invalid crop dimensions')
        }

        // Use the image ref if available, otherwise create new image
        const image = imgRef.current || new window.Image()
        if (!imgRef.current) {
          image.src = selectedImage
          // Wait for image to load
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('Failed to load image'))
          })
        }

        const canvas = document.createElement('canvas')

        // Calculate scale between displayed image and natural size
        const scaleX = image.naturalWidth / (image.width || image.naturalWidth)
        const scaleY = image.naturalHeight / (image.height || image.naturalHeight)

        // Calculate actual crop dimensions in the source image
        const sourceX = completedCrop.x * scaleX
        const sourceY = completedCrop.y * scaleY
        const sourceWidth = completedCrop.width * scaleX
        const sourceHeight = completedCrop.height * scaleY

        // Target size: 900x720 (5:4 ratio)
        const targetWidth = Math.min(900, sourceWidth)
        const targetHeight = (targetWidth * 4) / 5

        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        // Draw the cropped portion from the source image
        ctx.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          targetWidth,
          targetHeight
        )

        // Convert cropped canvas to blob with compression
        const croppedBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob from canvas'))
          }, 'image/jpeg', 0.8)
        })

        // Compress original image by drawing to canvas at max 1600px width
        const originalCanvas = document.createElement('canvas')
        const maxOriginalWidth = 1600
        const originalScale = Math.min(1, maxOriginalWidth / image.naturalWidth)
        originalCanvas.width = image.naturalWidth * originalScale
        originalCanvas.height = image.naturalHeight * originalScale

        const originalCtx = originalCanvas.getContext('2d')
        if (!originalCtx) throw new Error('Failed to get canvas context for original')

        originalCtx.drawImage(image, 0, 0, originalCanvas.width, originalCanvas.height)

        const originalBlob = await new Promise<Blob>((resolve, reject) => {
          originalCanvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob from original'))
          }, 'image/jpeg', 0.85)
        })

        // Upload both original and cropped
        const formDataUpload = new FormData()
        formDataUpload.append('original', originalBlob, 'original.jpg')
        formDataUpload.append('cropped', croppedBlob, 'cropped.jpg')
        formDataUpload.append('eventTitle', formData.title)

        console.log('Uploading images:', {
          originalSize: originalBlob.size,
          croppedSize: croppedBlob.size,
          title: formData.title
        })

        const uploadResponse = await fetch('/api/events/upload-image', {
          method: 'POST',
          body: formDataUpload
        })

        console.log('Upload response:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          ok: uploadResponse.ok
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          console.error('Upload error response:', errorData)
          throw new Error(errorData.error || errorData.message || 'Failed to upload images')
        }

        const data = await uploadResponse.json()
        original_image_url = data.original_url
        cropped_image_url = data.cropped_url

      } catch (error) {
        console.error('Image upload failed:', error)
        alert(`Failed to upload images: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setUploading(false)
        return
      }
      setUploading(false)
    }

    // Add to cart
    const cartItem: CartItem = {
      ...formData,
      id: Date.now().toString(),
      original_image_url,
      cropped_image_url
    }

    const updatedCart = [...cart, cartItem]
    saveCart(updatedCart)

    // Reset form
    setFormData({
      title: '',
      description: '',
      start_date: '',
      start_hour: '12',
      start_minute: '00',
      start_ampm: 'PM',
      end_hour: '12',
      end_minute: '00',
      end_ampm: 'PM',
      venue_id: formData.venue_id, // Keep venue selected
      venue_name: formData.venue_name,
      venue_street: formData.venue_street,
      venue_city: formData.venue_city,
      venue_state: formData.venue_state,
      venue_zip: formData.venue_zip,
      submitter_first_name: '', // Will be filled at checkout
      submitter_last_name: '',
      submitter_email: '',
      submitter_phone: '',
      url: '',
      placement_type: 'none'
    })
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    alert('Event added to cart!')
  }

  const removeFromCart = (id: string) => {
    const updatedCart = cart.filter(item => item.id !== id)
    saveCart(updatedCart)
  }

  const proceedToCheckout = () => {
    if (cart.length === 0) {
      alert('Your cart is empty')
      return
    }
    router.push('/events/checkout')
  }

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      if (item.placement_type === 'paid') return total + pricing.paidPlacement
      if (item.placement_type === 'featured') return total + pricing.featured
      return total
    }, 0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo Header */}
      <div className="bg-blue-600 py-3">
        <div className="max-w-4xl mx-auto px-4">
          <img
            src="https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png"
            alt="St. Cloud Scoop"
            className="h-16 md:h-24 w-auto mx-auto"
          />
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Your Event</h1>
            <p className="text-gray-600">
              Share your event with the St. Cloud community. Add to cart and promote multiple events in one transaction.
            </p>
          </div>

        {/* Event Submission Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Details</h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter event title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your event"
              />
            </div>

            {/* Date & Time - One Row on Desktop */}
            <div>
              <p className="text-xs text-blue-600 mb-2">
                Note: If your event spans multiple days, please submit each day as its own event.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={formData.start_hour}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_hour: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                    <select
                      value={formData.start_minute}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_minute: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="00">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                    <select
                      value={formData.start_ampm}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_ampm: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={formData.end_hour}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_hour: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                    <select
                      value={formData.end_minute}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_minute: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="00">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                    <select
                      value={formData.end_ampm}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_ampm: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Venue Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Venue <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.venue_id}
                onChange={(e) => handleVenueChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a venue</option>
                <option value="add-new">+ Add New Venue</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </div>

            {/* Add New Venue Form */}
            {showAddVenue && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h3 className="font-medium text-gray-900">New Venue Information</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Venue Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.venue_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Venue name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.venue_street}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue_street: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.venue_city}
                      onChange={(e) => setFormData(prev => ({ ...prev, venue_city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="St. Cloud"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.venue_state}
                      onChange={(e) => setFormData(prev => ({ ...prev, venue_state: e.target.value.toUpperCase().slice(0, 2) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="MN"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.venue_zip}
                      onChange={(e) => setFormData(prev => ({ ...prev, venue_zip: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="56301"
                      maxLength={5}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Event URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event URL (optional)
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/event"
              />
            </div>

            {/* Placement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Promotion Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center group relative">
                  <input
                    type="radio"
                    name="placement"
                    value="none"
                    checked={formData.placement_type === 'none'}
                    onChange={(e) => setFormData(prev => ({ ...prev, placement_type: 'none' }))}
                    className="mr-2"
                  />
                  <span className="flex items-center gap-1">
                    Free Listing (no promotion)
                    <span className="inline-block text-gray-400 cursor-help">ⓘ</span>
                  </span>
                  <div className="absolute left-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-3 w-64 z-10">
                    <p className="font-semibold mb-1">Free Listing includes:</p>
                    <ul className="space-y-1">
                      <li>• Event added to the public events page</li>
                      <li>• Eligible to appear in the newsletter (random selection if space is available)</li>
                      <li>• No guarantee of email placement</li>
                    </ul>
                  </div>
                </label>
                <label className="flex items-center group relative">
                  <input
                    type="radio"
                    name="placement"
                    value="paid"
                    checked={formData.placement_type === 'paid'}
                    onChange={(e) => setFormData(prev => ({ ...prev, placement_type: 'paid' }))}
                    className="mr-2"
                  />
                  <span className="flex items-center gap-1">
                    Guaranteed Placement (3 days*) - ${pricing.paidPlacement}
                    <span className="inline-block text-gray-400 cursor-help">ⓘ</span>
                  </span>
                  <div className="absolute left-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-3 w-64 z-10">
                    <p className="font-semibold mb-1">Guaranteed Placement includes:</p>
                    <ul className="space-y-1">
                      <li>• Guaranteed spot in the newsletter's daily list of 8 events</li>
                      <li>• Standard placement without description or image</li>
                      <li>• Event also listed on the public events page</li>
                    </ul>
                  </div>
                </label>
                <label className="flex items-center group relative">
                  <input
                    type="radio"
                    name="placement"
                    value="featured"
                    checked={formData.placement_type === 'featured'}
                    onChange={(e) => setFormData(prev => ({ ...prev, placement_type: 'featured' }))}
                    className="mr-2"
                  />
                  <span className="flex items-center gap-1">
                    Featured Event (3 days*) - ${pricing.featured}
                    <span className="inline-block text-gray-400 cursor-help">ⓘ</span>
                  </span>
                  <div className="absolute left-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-3 w-64 z-10">
                    <p className="font-semibold mb-1">Featured Event includes:</p>
                    <ul className="space-y-1">
                      <li>• Guaranteed top placement in the newsletter</li>
                      <li>• Event description and image (if provided) included</li>
                      <li>• Maximum visibility and engagement</li>
                    </ul>
                  </div>
                </label>
              </div>
            </div>

            {/* Image Upload - Available for all event types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Image {formData.placement_type === 'featured' && <span className="text-red-500">*</span>}
                {formData.placement_type !== 'featured' && <span className="text-gray-500 text-sm">(Optional)</span>}
              </label>
              <p className="text-xs text-gray-500 mb-2">Max 5MB, JPG format, will be cropped to 5:4 ratio (900x720px)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Image Cropper */}
            {selectedImage && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Crop Image (5:4 ratio)
                </label>
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={5 / 4}
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

            {/* Add to Cart Button */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={addToCart}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium"
              >
                {uploading ? 'Uploading...' : 'Add to Cart'}
              </button>
            </div>

            {/* Disclaimer */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
              <p className="text-xs text-gray-600">
                Each newsletter features 8 events for today, tomorrow, and the following day. *If submitted at least 4 days in advance, your event can appear in up to 3 newsletters leading up to the event date. Free events may be randomly selected if space allows, while promoted events are guaranteed placement. Featured events get top visibility with details and an image.
              </p>
            </div>
          </div>
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Cart ({cart.length} events)</h2>

            <div className="space-y-4 mb-6">
              {cart.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.venue_name || 'No venue'}</p>
                      <p className="text-sm text-gray-500">
                        {item.placement_type === 'paid' && `Paid Placement: $${pricing.paidPlacement}`}
                        {item.placement_type === 'featured' && `Featured Event: $${pricing.featured}`}
                        {item.placement_type === 'none' && 'Free Listing'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-blue-600">${calculateTotal().toFixed(2)}</span>
              </div>
              <button
                onClick={proceedToCheckout}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md font-medium text-lg"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
