'use client'

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

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
  const email = searchParams.get('email') || ''

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jobType, setJobType] = useState('')
  const [yearlyClients, setYearlyClients] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Show error if no email provided
  useEffect(() => {
    if (!email) {
      setError('No email found. Please go back and subscribe first.')
    }
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setError('No email found. Please go back and subscribe first.')
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
      const response = await fetch('/api/subscribe/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: firstName.trim(),
          last_name: lastName.trim(),
          job_type: jobType,
          yearly_clients: yearlyClients,
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Trigger SparkLoop/Upscribe popup
        triggerUpscribePopup(email)
      } else {
        setError(data.error || 'Update failed. Please try again.')
        setIsSubmitting(false)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  const loadSparkLoopScript = (): Promise<void> => {
    return new Promise((resolve) => {
      // Check if already loaded
      if ((window as any).SparkLoop) {
        resolve()
        return
      }

      // Check if script is already in DOM
      if (document.getElementById('sparkloop-script')) {
        // Wait for it to load
        const checkLoaded = setInterval(() => {
          if ((window as any).SparkLoop) {
            clearInterval(checkLoaded)
            resolve()
          }
        }, 100)
        return
      }

      // Dynamically load SparkLoop script
      const script = document.createElement('script')
      script.id = 'sparkloop-script'
      script.src = 'https://js.sparkloop.app/embed.js?publication_id=pub_6b958dc16ac6'
      script.async = true
      script.setAttribute('data-sparkloop', '')
      script.setAttribute('data-sparkloop-autoshow', 'false')

      script.onload = () => {
        // Wait a moment for SparkLoop to initialize
        setTimeout(() => resolve(), 500)
      }

      script.onerror = () => {
        console.error('Failed to load SparkLoop script')
        resolve() // Resolve anyway so we can redirect
      }

      document.body.appendChild(script)
    })
  }

  const triggerUpscribePopup = async (subscriberEmail: string) => {
    try {
      // Load SparkLoop script dynamically
      await loadSparkLoopScript()

      if ((window as any).SparkLoop) {
        // SparkLoop Upscribe popup - pass the email for pre-filling
        (window as any).SparkLoop.Upscribe({
          email: subscriberEmail,
          onComplete: () => {
            // Redirect to main website after completion
            window.location.href = '/'
          },
          onClose: () => {
            // Also redirect if user closes the popup
            window.location.href = '/'
          }
        })
      } else {
        console.log('SparkLoop not available after loading, redirecting...')
        window.location.href = '/'
      }
    } catch (err) {
      console.error('SparkLoop error:', err)
      window.location.href = '/'
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
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

      {!error && email && (
        <p className="text-sm text-slate-500">
          Signing up as <span className="font-medium text-slate-700">{email}</span>
        </p>
      )}
    </div>
  )
}
