export interface RedNoteMediaItem {
  id: string
  kind: 'image' | 'video'
  url: string
  mimeType: string
  posterUrl?: string
  caption: string
  width: number
  height: number
  durationMs?: number
  ordinal: number
}

export interface RedNoteVerification {
  url: string
  caption: string
}

export interface RedNoteMediaData {
  groupId: string
  title: string
  author?: string
  postUrl?: string
  items: RedNoteMediaItem[]
  verification?: RedNoteVerification
}

const DIRECTIVE_PATTERN = /\[\[rednote_media\]\]([\s\S]*?)\[\[\/rednote_media\]\]/g
const EVIDENCE_PATH = /^\/evidence\/v1\/[^/]+\/[^/]+\/?$/
const POST_PATH = /^\/explore\/[^/]+\/?$/
const IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])

function shortText(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(minimum, Math.min(Math.round(value), maximum))
}

function normalizeEvidenceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  try {
    const parsed = new URL(value.trim())
    const queryEntries = [...parsed.searchParams.entries()]
    if (
      !['http:', 'https:'].includes(parsed.protocol)
      || !EVIDENCE_PATH.test(parsed.pathname)
      || parsed.username
      || parsed.password
      || queryEntries.length !== 1
      || queryEntries[0][0] !== 'token'
      || !queryEntries[0][1]
    ) return undefined

    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function normalizePostUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  try {
    const parsed = new URL(value.trim())
    const trustedHost = parsed.hostname === 'rednote.com' || parsed.hostname === 'www.rednote.com'
    if (
      parsed.protocol !== 'https:'
      || !trustedHost
      || !POST_PATH.test(parsed.pathname)
      || parsed.port
      || parsed.username
      || parsed.password
    ) return undefined

    parsed.hostname = 'www.rednote.com'
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function normalizeMediaItem(value: unknown, index: number): RedNoteMediaItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const url = normalizeEvidenceUrl(item.url)
  const mimeType = typeof item.mime_type === 'string' ? item.mime_type.trim().toLowerCase() : ''
  const kind = item.kind === 'video' ? 'video' : item.kind === 'image' ? 'image' : null
  const validType = kind === 'video' ? VIDEO_TYPES.has(mimeType) : IMAGE_TYPES.has(mimeType)
  if (!url || !kind || !validType || (kind === 'video' && item.playable !== true)) {
    return null
  }

  return {
    id: shortText(item.id, `${kind}-${index + 1}`, 160),
    kind,
    url,
    mimeType,
    posterUrl: normalizeEvidenceUrl(item.poster_url),
    caption: shortText(item.caption, 'RedNote video', 240),
    width: boundedNumber(item.width, 720, 160, 3840),
    height: boundedNumber(item.height, 1280, 160, 3840),
    durationMs: typeof item.duration_ms === 'number' && Number.isFinite(item.duration_ms)
      ? Math.max(0, Math.round(item.duration_ms))
      : undefined,
    ordinal: boundedNumber(item.ordinal, index, 0, 10_000),
  }
}

function normalizeVerification(value: unknown): RedNoteVerification | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const data = value as Record<string, unknown>
  const url = normalizeEvidenceUrl(data.url)
  const mimeType = typeof data.mime_type === 'string' ? data.mime_type.trim().toLowerCase() : ''
  if (!url || !IMAGE_TYPES.has(mimeType)) return undefined
  return {
    url,
    caption: shortText(data.content, 'RedNote post verification screenshot', 240),
  }
}

function normalizeMedia(value: unknown): RedNoteMediaData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.provider !== 'rednote' || !Array.isArray(data.items)) return null

  const seen = new Set<string>()
  const items = data.items
    .slice(0, 8)
    .map(normalizeMediaItem)
    .filter((item): item is RedNoteMediaItem => {
      if (!item || seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
    .sort((left, right) => left.ordinal - right.ordinal)
  if (!items.length) return null

  return {
    groupId: shortText(data.group_id, items[0].id, 160),
    title: shortText(data.title, 'RedNote post', 240),
    author: typeof data.author === 'string' && data.author.trim()
      ? data.author.trim().slice(0, 160)
      : undefined,
    postUrl: normalizePostUrl(data.post_url),
    items,
    verification: normalizeVerification(data.verification),
  }
}

export function extractRedNoteMedia(content: string): {
  text: string
  media: RedNoteMediaData[]
} {
  const media: RedNoteMediaData[] = []
  const seen = new Set<string>()
  const text = content.replace(DIRECTIVE_PATTERN, (_directive, raw: string) => {
    try {
      const normalized = normalizeMedia(JSON.parse(raw))
      if (normalized) {
        const key = `${normalized.groupId}:${normalized.items.map(item => item.url).join('|')}`
        if (!seen.has(key)) {
          seen.add(key)
          media.push(normalized)
        }
      }
    } catch {
      // This block carries display metadata and should never appear as chat text.
    }
    return ''
  }).trim()

  return { text, media }
}

export function RedNoteMediaCards({ media }: { media: RedNoteMediaData[] }) {
  if (!media.length) return null

  return (
    <div className="flex w-full flex-col gap-3">
      {media.map(card => (
        <section
          key={`${card.groupId}:${card.items[0].url}`}
          className="w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
        >
          <div className="border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">{card.title}</h3>
            {card.author && <p className="mt-0.5 text-xs text-neutral-500">{card.author}</p>}
          </div>
          <div className="flex flex-col gap-px bg-neutral-100">
            {card.items.map(item => item.kind === 'video' ? (
                <video
                  key={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  poster={item.posterUrl}
                  aria-label={item.caption}
                  className="block max-h-[36rem] w-full bg-black object-contain"
                  style={{ aspectRatio: `${item.width} / ${item.height}` }}
                >
                  <source src={item.url} type={item.mimeType} />
                  Your browser does not support video playback.
                </video>
              ) : (
                // This URL is a signed server evidence asset, so Next image optimisation is not used.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={item.url}
                  src={item.url}
                  alt={item.caption}
                  loading="lazy"
                  className="block max-h-[36rem] w-full bg-white object-contain"
                  style={{ aspectRatio: `${item.width} / ${item.height}` }}
                />
              ))}
          </div>
          {card.verification && (
            <details className="border-t border-neutral-100 px-4 py-3">
              <summary className="cursor-pointer text-xs font-medium text-neutral-600">
                Verification screenshot
              </summary>
              {/* This is a signed, short-lived server evidence URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.verification.url}
                alt={card.verification.caption}
                loading="lazy"
                className="mt-3 max-h-80 w-full rounded-lg border border-neutral-200 object-contain"
              />
            </details>
          )}
          {card.postUrl && (
            <a
              href={card.postUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="block border-t border-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Open this post on RedNote
            </a>
          )}
        </section>
      ))}
    </div>
  )
}
