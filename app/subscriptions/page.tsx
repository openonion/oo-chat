'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChatLayout } from '@/components/chat-layout'
import { useIdentity } from '@/hooks/use-identity'
import { HiOutlineRefresh, HiOutlineX } from 'react-icons/hi'

interface Subscription {
  sender_name: string
  sender_email: string
  unsubscribe_link: string
  email_web_link: string
}

interface SubscriptionData {
  [category: string]: Subscription[]
}

interface UnsubscribedEntry {
  sender_name: string
  sender_email: string
  category: string
  unsubscribed_at: number
}

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; border: string }> = {
  'Gaming': { emoji: '🎮', color: 'text-violet-700', border: 'border-violet-100' },
  'Gaming & Entertainment': { emoji: '🎮', color: 'text-violet-700', border: 'border-violet-100' },
  'Marketing & Retail': { emoji: '🛒', color: 'text-blue-700', border: 'border-blue-100' },
  'Newsletters': { emoji: '📰', color: 'text-emerald-700', border: 'border-emerald-100' },
  'Transactional': { emoji: '🤖', color: 'text-amber-700', border: 'border-amber-100' },
  'Transactional (recommended keep)': { emoji: '🤖', color: 'text-amber-700', border: 'border-amber-100' },
  'Social & Notifications': { emoji: '💬', color: 'text-pink-700', border: 'border-pink-100' },
  'Likely Spam': { emoji: '🚨', color: 'text-red-700', border: 'border-red-100' },
  'Food': { emoji: '🍔', color: 'text-orange-700', border: 'border-orange-100' },
  'Tech': { emoji: '💻', color: 'text-cyan-700', border: 'border-cyan-100' },
  'Tech/Services': { emoji: '💻', color: 'text-cyan-700', border: 'border-cyan-100' },
  'Business/Productivity': { emoji: '📊', color: 'text-indigo-700', border: 'border-indigo-100' },
}

const DEFAULT_CATEGORY = { emoji: '📧', color: 'text-neutral-700', border: 'border-neutral-100' }

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || DEFAULT_CATEGORY
}

function hasUnsubscribeLink(link: string): boolean {
  if (!link) return false
  const lower = link.toLowerCase()
  return lower.startsWith('http') && !lower.includes('not found') && !lower.includes('no direct')
}

export default function SubscriptionsPage() {
  useIdentity()
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [unsubscribed, setUnsubscribed] = useState<Set<string>>(new Set())
  const [unsubscribedList, setUnsubscribedList] = useState<UnsubscribedEntry[]>([])
  const [pendingUnsub, setPendingUnsub] = useState<Set<string>>(new Set())

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    sub: Subscription
    category: string
  } | null>(null)
  const [archiveEmails, setArchiveEmails] = useState(true)
  const [archiving, setArchiving] = useState<Set<string>>(new Set())

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/subscriptions').then(r => r.json()),
      fetch('/api/subscriptions/unsubscribed').then(r => r.json()),
    ])
      .then(([subJson, unsubJson]) => {
        if (subJson.error) {
          setError(subJson.error)
        } else {
          setData(subJson.data)
          if (subJson.lastUpdated) {
            const date = new Date(subJson.lastUpdated * 1000)
            setLastUpdated(date.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }))
          }
        }
        if (unsubJson.data) {
          setUnsubscribedList(unsubJson.data)
          setUnsubscribed(new Set(unsubJson.data.map((e: UnsubscribedEntry) => e.sender_email)))
        }
      })
      .catch(() => setError('Failed to load subscription data.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUnsubscribeClick = (sub: Subscription, category: string) => {
    setConfirmModal({ sub, category })
  }

  const handleConfirmUnsubscribe = async () => {
    if (!confirmModal) return

    const { sub, category } = confirmModal
    const shouldArchive = archiveEmails
    setConfirmModal(null)

    // Mark as pending
    setPendingUnsub(prev => new Set(prev).add(sub.sender_email))

    // Open the unsubscribe link
    window.open(sub.unsubscribe_link, '_blank')

    // Save to unsubscribed list
    try {
      const res = await fetch('/api/subscriptions/unsubscribed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: sub.sender_name,
          sender_email: sub.sender_email,
          category,
        }),
      })
      const json = await res.json()
      if (json.data) {
        setUnsubscribedList(json.data)
        setUnsubscribed(new Set(json.data.map((e: UnsubscribedEntry) => e.sender_email)))
      }
    } catch (err) {
      console.error('Failed to save unsubscribe:', err)
    } finally {
      setPendingUnsub(prev => {
        const next = new Set(prev)
        next.delete(sub.sender_email)
        return next
      })
    }

    // Archive emails from this sender if checkbox was checked
    if (shouldArchive) {
      setArchiving(prev => new Set(prev).add(sub.sender_email))
      try {
        // Get agent URL from the store or environment
        const stored = localStorage.getItem('oo-chat-agents')
        const agents = stored ? JSON.parse(stored) : []
        const agentUrl = agents[0] || process.env.NEXT_PUBLIC_DEFAULT_AGENT_URL

        if (agentUrl) {
          await fetch('/api/subscriptions/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender_email: sub.sender_email,
              agent_url: agentUrl,
            }),
          })
        }
      } catch (err) {
        console.error('Failed to archive emails:', err)
      } finally {
        setArchiving(prev => {
          const next = new Set(prev)
          next.delete(sub.sender_email)
          return next
        })
      }
    }
  }

  const totalCount = data
    ? Object.values(data).reduce((sum, subs) => sum + subs.length, 0)
    : 0

  const activeCount = data
    ? Object.values(data).reduce((sum, subs) =>
        sum + subs.filter(s => !unsubscribed.has(s.sender_email)).length, 0)
    : 0

  const categoryCount = data ? Object.keys(data).length : 0

  return (
    <ChatLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Title */}
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-neutral-900">Subscriptions</h1>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-all disabled:opacity-50"
              title="Refresh"
            >
              <HiOutlineRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-6">
            Recurring email senders detected in your inbox. Run &quot;check subscriptions&quot; in chat to update.
          </p>

          {/* Last updated */}
          {lastUpdated && (
            <p className="text-xs text-neutral-400 mb-4">Last updated: {lastUpdated}</p>
          )}

          {/* Stats */}
          {data && !('raw' in data) && unsubscribed.size > 0 && (
            <div className="flex gap-3 mb-6">
              <div className="flex-1 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <p className="text-xs text-neutral-400 mb-0.5">Active</p>
                <p className="text-lg font-bold text-neutral-900">{activeCount}</p>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-emerald-600 mb-0.5">Unsubscribed</p>
                <p className="text-lg font-bold text-emerald-700">{unsubscribed.size}</p>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <p className="text-xs text-neutral-400 mb-0.5">Total found</p>
                <p className="text-lg font-bold text-neutral-900">{totalCount}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="py-12 text-center text-neutral-500">Loading...</div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="py-8 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-center text-sm">
              <p className="font-medium mb-1">{error}</p>
              <p className="text-xs text-amber-600">
                Type <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">check subscriptions</code> in the chat to scan your inbox first.
              </p>
            </div>
          )}

          {/* Categories */}
          {!loading && !error && data && !('raw' in data) && Object.entries(data).map(([category, subscriptions]) => {
            const config = getCategoryConfig(category)
            const activeInCategory = subscriptions.filter(s => !unsubscribed.has(s.sender_email)).length

            return (
              <div key={category} className="mb-8">
                {/* Category header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-lg">{config.emoji}</span>
                  <h2 className={`text-xs font-black uppercase tracking-widest ${config.color}`}>
                    {category}
                  </h2>
                  <span className="text-xs text-neutral-300 ml-auto">
                    {activeInCategory}/{subscriptions.length}
                  </span>
                </div>

                {/* Items */}
                <div className={`rounded-2xl border ${config.border} overflow-hidden bg-white`}>
                  {subscriptions.map((sub: Subscription, i: number) => {
                    const isUnsub = unsubscribed.has(sub.sender_email)
                    const isPending = pendingUnsub.has(sub.sender_email)

                    return (
                      <div
                        key={`${sub.sender_email}-${i}`}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i > 0 ? `border-t ${config.border}` : ''
                        } ${isUnsub ? 'opacity-40' : 'hover:bg-neutral-50'} transition-all`}
                      >
                        {/* Sender info */}
                        <div className="flex-1 min-w-0 mr-4">
                          <div className={`text-sm font-bold ${isUnsub ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
                            {sub.sender_name}
                            {isUnsub && (
                              <span className="ml-2 no-underline text-xs font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded inline-block" style={{ textDecoration: 'none' }}>
                                unsubscribed
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-400 truncate">
                            {sub.sender_email}
                          </div>
                        </div>

                        {/* Action links */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sub.email_web_link && sub.email_web_link.startsWith('http') && (
                            <a
                              href={sub.email_web_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-neutral-400 hover:text-neutral-600 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-all"
                            >
                              View email
                            </a>
                          )}

                          {isUnsub ? (
                            <span className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                              archiving.has(sub.sender_email)
                                ? 'text-amber-500 border-amber-200 bg-amber-50'
                                : 'text-emerald-500 border-emerald-200 bg-emerald-50'
                            }`}>
                              {archiving.has(sub.sender_email) ? 'Archiving...' : 'Done'}
                            </span>
                          ) : hasUnsubscribeLink(sub.unsubscribe_link) ? (
                            <button
                              onClick={() => handleUnsubscribeClick(sub, category)}
                              disabled={isPending}
                              className="text-xs font-bold text-red-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                              {isPending ? 'Opening...' : 'Unsubscribe'}
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-300 px-2.5 py-1.5">
                              No unsub link
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Unsubscribed history */}
          {!loading && unsubscribedList.length > 0 && (
            <div className="mt-12 mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-lg">✅</span>
                <h2 className="text-xs font-black uppercase tracking-widest text-emerald-700">
                  Unsubscribed
                </h2>
                <span className="text-xs text-neutral-300 ml-auto">
                  {unsubscribedList.length}
                </span>
              </div>

              <div className="rounded-2xl border border-emerald-100 overflow-hidden bg-white">
                {unsubscribedList.map((entry, i) => (
                  <div
                    key={`${entry.sender_email}-${i}`}
                    className={`flex items-center justify-between px-4 py-3 opacity-60 ${
                      i > 0 ? 'border-t border-emerald-100' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="text-sm font-bold text-neutral-500 line-through">
                        {entry.sender_name}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {entry.sender_email}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400">
                      {new Date(entry.unsubscribed_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary stats */}
          {!loading && !error && data && !('raw' in data) && Object.keys(data).length > 0 && unsubscribed.size === 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-sm font-medium text-neutral-700">
                {totalCount} subscription{totalCount !== 1 ? 's' : ''} found across {categoryCount} categor{categoryCount !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          )}

          {/* Raw fallback */}
          {!loading && !error && data && 'raw' in data && (
            <div className="rounded-2xl border border-neutral-100 bg-white p-6">
              <p className="text-xs text-neutral-500 mb-3">
                Subscription data could not be parsed. Raw results:
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-800 leading-relaxed">
                {(data as unknown as { raw: string }).raw}
              </pre>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && data && !('raw' in data) && Object.keys(data).length === 0 && (
            <p className="text-neutral-500">No subscriptions found yet. Run &quot;check subscriptions&quot; in chat to scan.</p>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white rounded-2xl border border-neutral-100 shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <span className="text-red-500 text-sm font-bold">X</span>
              </div>
              <button
                onClick={() => setConfirmModal(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal content */}
            <h3 className="text-lg font-bold text-neutral-900 mb-1">
              Unsubscribe from {confirmModal.sub.sender_name}?
            </h3>
            <p className="text-sm text-neutral-500 mb-2">
              This will open the unsubscribe page for:
            </p>
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-4">
              <p className="text-sm font-bold text-neutral-800">{confirmModal.sub.sender_name}</p>
              <p className="text-xs text-neutral-400">{confirmModal.sub.sender_email}</p>
            </div>

            <p className="text-xs text-neutral-400 mb-4">
              You may need to confirm the unsubscription on the page that opens. This action cannot be undone.
            </p>

            {/* Archive checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-6 cursor-pointer hover:bg-neutral-100 transition-colors">
              <input
                type="checkbox"
                checked={archiveEmails}
                onChange={e => setArchiveEmails(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300"
              />
              <div>
                <p className="text-sm font-medium text-neutral-700">Also archive emails from this sender</p>
                <p className="text-xs text-neutral-400 mt-0.5">Removes their emails from your inbox. They can still be found in All Mail.</p>
              </div>
            </label>

            {/* Modal actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnsubscribe}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
              >
                Unsubscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </ChatLayout>
  )
}
