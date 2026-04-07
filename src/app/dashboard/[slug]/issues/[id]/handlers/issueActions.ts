import type { issueWithArticles } from '@/types/database'

type SetIssue = React.Dispatch<React.SetStateAction<issueWithArticles | null>>

export function createIssueActions(
  getIssue: () => issueWithArticles | null,
  setissue: SetIssue,
  setProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setProcessingStatus: React.Dispatch<React.SetStateAction<string>>,
  setGeneratingSubject: React.Dispatch<React.SetStateAction<boolean>>,
  setPreviewLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setPreviewHtml: React.Dispatch<React.SetStateAction<string | null>>,
  setShowPreview: React.Dispatch<React.SetStateAction<boolean>>,
  setSendingTest: React.Dispatch<React.SetStateAction<boolean>>,
  setTestSendStatus: React.Dispatch<React.SetStateAction<string>>,
  setUpdatingStatus: React.Dispatch<React.SetStateAction<boolean>>,
  setEditingSubject: React.Dispatch<React.SetStateAction<boolean>>,
  setSavingSubject: React.Dispatch<React.SetStateAction<boolean>>,
  editSubjectValue: () => string,
  setEditSubjectValue: React.Dispatch<React.SetStateAction<string>>,
  fetchissue: (id: string) => Promise<void>,
) {
  const previewNewsletter = async () => {
    const issue = getIssue()
    if (!issue) return

    setPreviewLoading(true)
    try {
      console.log('Calling preview API for issue:', issue.id)
      const response = await fetch(`/api/campaigns/${issue.id}/preview`)
      console.log('Preview API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`
        console.error('Preview API error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Preview data received:', !!data.html, 'HTML length:', data.html?.length)
      setPreviewHtml(data.html)
      setShowPreview(true)
    } catch (error) {
      console.error('Preview error:', error)
      alert('Failed to generate preview: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const sendTestEmail = async () => {
    const issue = getIssue()
    if (!issue) return

    setSendingTest(true)
    setTestSendStatus('')
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to send test email')
        return
      }

      setTestSendStatus('Test email scheduled! Check your inbox in ~2 minutes.')
      setTimeout(() => setTestSendStatus(''), 10000)
    } catch (err) {
      alert('Failed to send test email. Check console for details.')
      console.error('Send test email error:', err)
    } finally {
      setSendingTest(false)
    }
  }

  const processRSSFeeds = async () => {
    const issue = getIssue()
    if (!issue) return

    setProcessing(true)
    setProcessingStatus('Starting reprocess workflow...')

    try {
      const response = await fetch(`/api/campaigns/${issue.id}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        let errorMessage = 'Reprocess failed'
        try {
          const data = await response.json()
          errorMessage = data.message || data.error || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('[Client] Reprocess workflow started:', data)

      setProcessingStatus('Workflow started! Articles will regenerate in background. Refresh page to see progress.')

      setTimeout(async () => {
        await fetchissue(issue.id)
        setProcessingStatus('')
      }, 3000)

    } catch (error) {
      setProcessingStatus('')
      alert('Failed to start reprocess: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setProcessing(false)
    }
  }

  const generateSubjectLine = async () => {
    const issue = getIssue()
    if (!issue) return

    const activeArticles = issue.articles.filter(article => article.is_active)
    if (activeArticles.length === 0) {
      alert('Please select at least one article before generating a subject line.')
      return
    }

    setGeneratingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/generate-subject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate subject line')
      }

      const data = await response.json()

      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          subject_line: data.subject_line
        }
      })

      console.log(`Generated subject line: "${data.subject_line}" (${data.character_count} characters)`)

    } catch (error) {
      alert('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setGeneratingSubject(false)
    }
  }

  const startEditingSubject = () => {
    const issue = getIssue()
    setEditSubjectValue(issue?.subject_line || '')
    setEditingSubject(true)
  }

  const cancelEditingSubject = () => {
    setEditingSubject(false)
    setEditSubjectValue('')
  }

  const saveSubjectLine = async () => {
    const issue = getIssue()
    if (!issue) return

    setSavingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/subject-line`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_line: editSubjectValue().trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update subject line')
      }

      const data = await response.json()
      setissue(prev => prev ? { ...prev, subject_line: data.subject_line } : null)
      setEditingSubject(false)
      setEditSubjectValue('')

    } catch (error) {
      alert('Failed to save subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSavingSubject(false)
    }
  }

  const updateIssueStatus = async (action: 'changes_made') => {
    const issue = getIssue()
    if (!issue) return

    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update issue status')
      }

      const data = await response.json()

      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'changes_made',
          last_action: action,
          last_action_at: data.issue.last_action_at,
          last_action_by: data.issue.last_action_by
        }
      })

      alert(`issue marked as "Changes Made" and status updated. Slack notification sent.`)

    } catch (error) {
      alert('Failed to update issue status: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  return {
    previewNewsletter,
    sendTestEmail,
    processRSSFeeds,
    generateSubjectLine,
    startEditingSubject,
    cancelEditingSubject,
    saveSubjectLine,
    updateIssueStatus,
  }
}
