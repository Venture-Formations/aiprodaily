'use client'

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"

// Declare SparkLoop global for TypeScript
declare global {
  interface Window {
    Slb?: {
      show?: () => void;
      open?: () => void;
    };
    SparkLoop?: {
      show?: () => void;
      open?: () => void;
    };
  }
}

const JOB_TYPE_OPTIONS = [
  { value: 'partner_owner', label: 'Partner/Owner' },
  { value: 'cfo', label: 'CFO' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'bookkeeper', label: 'Bookkeeper' },
  { value: 'other', label: 'Other' },
]

const YEARLY_CLIENTS_OPTIONS = [
  { value: '1', label: '1 (just my employer\'s or my own company)' },
  { value: '2-20', label: '2-20' },
  { value: '21-100', label: '21-100' },
  { value: '101-299', label: '101-299' },
  { value: '300+', label: '300+' },
]

export function PersonalizationForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(initialEmail)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jobType, setJobType] = useState('')
  const [yearlyClients, setYearlyClients] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const sparkLoopTriggered = useRef(false)

  // Show error if no email provided
  useEffect(() => {
    if (!initialEmail) {
      setError('No email found. Please go back and subscribe first.')
    }
  }, [initialEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (!firstName.trim()) {
      setError('Please enter your first name')
      return
    }

    if (!jobType) {
      setError('Please select your job type')
      return
    }

    if (!yearlyClients) {
      setError('Please select how many clients you handle')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // If email was corrected, pass both old and new email
      const emailChanged = email !== initialEmail && initialEmail !== ''

      const response = await fetch('/api/subscribe/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          original_email: emailChanged ? initialEmail : undefined,
          name: firstName.trim(),
          last_name: lastName.trim(),
          job_type: jobType,
          yearly_clients: yearlyClients,
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to AfterOffers with subscriber email
        window.location.href = `https://offers.afteroffers.com/show_offers/994-2MMat6y-1?email=${encodeURIComponent(email)}`
      } else {
        setError(data.error || 'Update failed. Please try again.')
        setIsSubmitting(false)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Load SparkLoop script and trigger popup on page load
  useEffect(() => {
    if (typeof window === 'undefined' || sparkLoopTriggered.current || !initialEmail) return

    const triggerSparkLoopPopup = () => {
      if (sparkLoopTriggered.current) return
      const win = window as any

      console.log('[SparkLoop] Attempting to trigger popup for email:', initialEmail)
      console.log('[SparkLoop] Available globals:', {
        SL: !!win.SL,
        SLConfig: !!win.SLConfig,
        sparkloop: !!win.sparkloop,
      })

      // Log all SL properties to find available methods
      if (win.SL) {
        console.log('[SparkLoop] SL object:', Object.keys(win.SL))
      }

      // Try to set subscriber data directly
      if (win.SL) {
        // Set visitor/subscriber email
        if (win.SL.visitor) {
          win.SL.visitor.email = initialEmail
          console.log('[SparkLoop] Set SL.visitor.email')
        }

        // Try to call any show/display methods
        if (typeof win.SL.showWidget === 'function') {
          win.SL.showWidget()
          sparkLoopTriggered.current = true
          return
        }
        if (typeof win.SL.show === 'function') {
          win.SL.show()
          sparkLoopTriggered.current = true
          return
        }
        if (typeof win.SL.openHub === 'function') {
          win.SL.openHub()
          sparkLoopTriggered.current = true
          return
        }

        // Try trackSubscriber if available
        if (typeof win.SL.trackSubscriber === 'function') {
          win.SL.trackSubscriber({ email: initialEmail })
          sparkLoopTriggered.current = true
          return
        }
      }

      // Create a visible form briefly and submit it programmatically
      const triggerForm = document.createElement('form')
      triggerForm.id = 'sl-trigger-form'
      triggerForm.method = 'POST'
      triggerForm.action = '#'
      triggerForm.style.cssText = 'position:absolute;left:-9999px;'

      const emailInput = document.createElement('input')
      emailInput.type = 'email'
      emailInput.name = 'email'
      emailInput.id = 'sl-email'
      emailInput.value = initialEmail
      triggerForm.appendChild(emailInput)

      const submitBtn = document.createElement('button')
      submitBtn.type = 'submit'
      triggerForm.appendChild(submitBtn)

      document.body.appendChild(triggerForm)

      // Let SparkLoop detect the form, then click submit
      setTimeout(() => {
        console.log('[SparkLoop] Clicking hidden form submit')
        submitBtn.click()
        sparkLoopTriggered.current = true

        // Remove form after attempt
        setTimeout(() => triggerForm.remove(), 3000)
      }, 500)
    }

    // Load SparkLoop script
    if (!document.getElementById('sparkloop-script')) {
      const script = document.createElement('script')
      script.id = 'sparkloop-script'
      script.src = 'https://js.sparkloop.app/embed.js?publication_id=pub_6b958dc16ac6'
      script.async = true
      script.setAttribute('data-sparkloop', '')

      script.onload = () => {
        console.log('[SparkLoop] Script loaded')
        // Give SparkLoop time to initialize
        setTimeout(triggerSparkLoopPopup, 1500)
      }

      document.body.appendChild(script)
    } else {
      setTimeout(triggerSparkLoopPopup, 500)
    }
  }, [initialEmail])

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 text-left mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            placeholder="you@example.com"
            className="w-full rounded-lg border-0 bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
          />
          {email !== initialEmail && initialEmail && (
            <p className="text-xs text-amber-600 mt-1 text-left">
              Email will be updated from {initialEmail}
            </p>
          )}
        </div>

        {/* Name Fields - Side by Side */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 text-left mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isSubmitting || !email}
              placeholder="John"
              className="w-full rounded-lg border-0 bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 text-left mb-1">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isSubmitting || !email}
              placeholder="Smith"
              className="w-full rounded-lg border-0 bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            />
          </div>
        </div>

        {/* Job Type Dropdown */}
        <div>
          <label htmlFor="jobType" className="block text-sm font-medium text-slate-700 text-left mb-1">
            What best describes your role? <span className="text-red-500">*</span>
          </label>
          <select
            id="jobType"
            required
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            disabled={isSubmitting || !email}
            className="w-full rounded-lg border-0 bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
          >
            <option value="">Select your role...</option>
            {JOB_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Yearly Clients Dropdown */}
        <div>
          <label htmlFor="yearlyClients" className="block text-sm font-medium text-slate-700 text-left mb-1">
            How many clients&apos; books/tax returns/financials do you handle yearly? <span className="text-red-500">*</span>
          </label>
          <select
            id="yearlyClients"
            required
            value={yearlyClients}
            onChange={(e) => setYearlyClients(e.target.value)}
            disabled={isSubmitting || !email}
            className="w-full rounded-lg border-0 bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
          >
            <option value="">Select an option...</option>
            {YEARLY_CLIENTS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="w-full rounded-full bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Complete Sign Up'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
