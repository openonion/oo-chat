'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentUI } from '../types'

type LinkedInEmbed = {
  url: string
  postUrl?: string
  title: string
  width: number
  height: number
}

function safeLinkedInUrl(value: unknown, embedOnly: boolean): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname)) {
      return undefined
    }
    if (embedOnly) {
      if (!/^\/embed\/feed\/update\/urn:li:(activity|share|ugcPost):\d+\/?$/i.test(url.pathname)) {
        return undefined
      }
      const collapsed = url.searchParams.get('collapsed')
      // Inspect is a Full post workflow. Refuse LinkedIn's collapsed/less-text
      // variant even if malformed or stale history tries to provide one.
      if (collapsed && collapsed !== '0') return undefined
      for (const key of url.searchParams.keys()) {
        if (key !== 'collapsed') return undefined
      }
    } else if (!(
      /^\/feed\/update\/urn:li:activity:\d+\/?$/i.test(url.pathname)
      || url.pathname.toLowerCase().startsWith('/posts/')
    )) {
      return undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}

function extractLinkedInEmbeds(content: string): { content: string; embeds: LinkedInEmbed[] } {
  const pattern = /\[\[linkedin_embed\]\]([\s\S]*?)\[\[\/linkedin_embed\]\]/g
  const embeds: LinkedInEmbed[] = []

  for (const match of content.matchAll(pattern)) {
    try {
      const payload = JSON.parse(match[1]) as Record<string, unknown>
      if (payload.provider !== 'linkedin') continue
      const url = safeLinkedInUrl(payload.url, true)
      if (!url) continue
      const rawWidth = typeof payload.width === 'number' ? payload.width : 504
      const rawHeight = typeof payload.height === 'number' ? payload.height : 900
      embeds.push({
        url,
        postUrl: safeLinkedInUrl(payload.post_url, false),
        title: typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim().slice(0, 160)
          : 'LinkedIn embedded post',
        width: Math.max(280, Math.min(1200, Math.round(rawWidth))),
        height: Math.max(320, Math.min(1800, Math.round(rawHeight))),
      })
    } catch {
      // Malformed or untrusted directives remain non-rendering text metadata.
    }
  }

  return {
    content: content.replace(pattern, '').trim(),
    embeds: embeds.filter((embed, index) => embeds.findIndex(item => item.url === embed.url) === index),
  }
}

export function Agent({ message }: { message: AgentUI }) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const rawContent = typeof message.content === 'string' ? message.content : ''
  const { content, embeds } = extractLinkedInEmbeds(rawContent)
  const images = Array.isArray(message.images) ? message.images : []
  const hasImages = images.length > 0
  const hasEmbeds = embeds.length > 0
  const hasText = content.trim().length > 0

  if (!hasText && !hasImages && !hasEmbeds) return null

  return (
    <div className="flex justify-start py-3 gap-3">
      {/* Agent avatar */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-xs">O</span>
      </div>
      <div className="max-w-[85%] text-neutral-800 flex flex-col gap-2">
        {/* Text content */}
        {hasText && (
          <div className="prose prose-sm prose-neutral max-w-none text-[15px] leading-7
            prose-headings:font-semibold prose-headings:text-neutral-900 prose-headings:mt-4 prose-headings:mb-2
            prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
            prose-p:my-2
            prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-medium prose-code:text-neutral-800 prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-[#1e1e1e] prose-pre:rounded-xl prose-pre:text-sm prose-pre:p-4 prose-pre:my-4 prose-pre:shadow-sm
            [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-neutral-100 [&_pre_code]:font-mono
            prose-table:text-sm prose-th:bg-neutral-50 prose-th:px-4 prose-th:py-2 prose-th:font-semibold prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-neutral-100
            prose-ul:my-3 prose-li:my-1
            prose-ol:my-3
            prose-a:text-neutral-900 prose-a:font-medium prose-a:underline prose-a:underline-offset-2 prose-a:decoration-neutral-300 hover:prose-a:decoration-neutral-900
            prose-blockquote:border-l-4 prose-blockquote:border-neutral-200 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-600
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}

        {/* Images - displayed below text */}
        {hasImages && (
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Open image ${i + 1} preview`}
                className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
                onClick={() => setPreviewImage(img)}
              >
                <img
                  src={img}
                  alt={`Image ${i + 1}`}
                  className="h-auto max-h-[52vh] w-full object-contain transition-opacity group-hover:opacity-90"
                />
                <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
                  Click to enlarge
                </span>
              </button>
            ))}
          </div>
        )}

        {hasEmbeds && (
          <div className="flex w-full flex-col gap-3">
            {embeds.map(embed => (
              <section
                key={embed.url}
                className="w-full max-w-[640px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-md"
                aria-label={embed.title}
              >
                <iframe
                  src={embed.url}
                  title={embed.title}
                  width={embed.width}
                  height={embed.height}
                  loading="lazy"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="block w-full border-0 bg-white"
                  style={{ height: `${embed.height}px`, maxHeight: '82vh' }}
                />
                {embed.postUrl && (
                  <a
                    href={embed.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-sm font-medium text-[#0a66c2] hover:bg-neutral-50"
                  >
                    <span>Open post on LinkedIn</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Enlarged evidence"
            className="max-h-[94vh] max-w-[96vw] cursor-default rounded-xl bg-white object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Close image preview"
            className="absolute right-5 top-5 rounded-full bg-white/95 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-lg"
            onClick={() => setPreviewImage(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
