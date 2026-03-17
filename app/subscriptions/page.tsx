'use client'

import { useEffect, useState } from 'react'
import { ChatLayout } from '@/components/chat-layout'
import { useIdentity } from '@/hooks/use-identity'
import { HiOutlineRefresh } from 'react-icons/hi'

interface Subscription {
  sender_name: string
  sender_email: string
  unsubscribe_link: string
  email_web_link: string
}

interface SubscriptionData {
  [category: string]: Subscription[]
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

  const fetchData = () => {
    setLoading(true)
    setError(null)
    let cancelled = false

    fetch('/api/subscriptions')
      .then(res => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          if (json.error) {
            setError(json.error)
          } else {
            setData(json.data)
            if (json.lastUpdated) {
              const date = new Date(json.lastUpdated * 1000)
              setLastUpdated(date.toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }))
            }
          }
        }
      })
      .catch(e => {
        if (!cancelled) setError(e.message || 'Failed to load subscription data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = fetchData()
    return cleanup
  }, [])

  const totalCount = data
    ? Object.values(data).reduce((sum, subs) => sum + subs.length, 0)
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

          {/* Loading */}
          {loading && (
            <div className="py-12 text-center text-neutral-500">Loading…</div>
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

            return (
              <div key={category} className="mb-8">
                {/* Category header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-lg">{config.emoji}</span>
                  <h2 className={`text-xs font-black uppercase tracking-widest ${config.color}`}>
                    {category}
                  </h2>
                  <span className="text-xs text-neutral-300 ml-auto">
                    {subscriptions.length}
                  </span>
                </div>

                {/* Items */}
                <div className={`rounded-2xl border ${config.border} overflow-hidden bg-white`}>
                  {subscriptions.map((sub: Subscription, i: number) => (
                    <div
                      key={`${sub.sender_email}-${i}`}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i > 0 ? `border-t ${config.border}` : ''
                      } hover:bg-neutral-50 transition-colors`}
                    >
                      {/* Sender info */}
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="text-sm font-bold text-neutral-900">
                          {sub.sender_name}
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

                        {hasUnsubscribeLink(sub.unsubscribe_link) ? (
                          <a
                            href={sub.unsubscribe_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-red-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 transition-all"
                          >
                            Unsubscribe
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-300 px-2.5 py-1.5">
                            No unsub link
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Summary stats */}
          {!loading && !error && data && !('raw' in data) && Object.keys(data).length > 0 && (
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
    </ChatLayout>
  )
}
