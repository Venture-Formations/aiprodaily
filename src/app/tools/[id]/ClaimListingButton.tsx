'use client'

import { useState } from 'react'
import { useUser, SignInButton } from '@clerk/nextjs'
import { ClaimModal } from './ClaimModalComponents'

interface ClaimListingButtonProps {
  toolId: string
  toolName: string
  description: string
  websiteUrl: string
  category: string
  currentLogoUrl: string | null
  currentImageUrl: string | null
  isToolClaimed: boolean
  currentUserHasListing: boolean
}

export function ClaimListingButton({
  toolId,
  toolName,
  description,
  websiteUrl,
  category,
  currentLogoUrl,
  currentImageUrl,
  isToolClaimed,
  currentUserHasListing,
}: ClaimListingButtonProps) {
  const { isSignedIn } = useUser()
  const [showModal, setShowModal] = useState(false)

  // Don't show button if tool is already claimed
  if (isToolClaimed) return null

  // Don't show button if current user already has a listing
  if (isSignedIn && currentUserHasListing) return null

  // If not signed in, show sign-in button
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="group inline-flex items-center justify-center rounded-full py-3 px-6 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors">
          Claim Listing
          <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </SignInButton>
    )
  }

  // Signed in and no existing listing - show claim button
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="group inline-flex items-center justify-center rounded-full py-3 px-6 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors"
      >
        Claim Listing
        <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <ClaimModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        toolId={toolId}
        initialData={{
          toolName,
          description,
          websiteUrl,
          category,
          logoUrl: currentLogoUrl,
          imageUrl: currentImageUrl,
        }}
      />
    </>
  )
}
