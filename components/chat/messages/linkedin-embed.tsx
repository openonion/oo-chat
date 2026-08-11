export interface LinkedInEmbedData {
  url: string
  postUrl?: string
  title: string
  width: number
  height: number
}

const DIRECTIVE_PATTERN = /\[\[linkedin_embed\]\]([\s\S]*?)\[\[\/linkedin_embed\]\]/g
const EMBED_PATH = /^\/embed\/feed\/update\/urn:li:(activity|share|ugcPost):\d+\/?$/i
const ACTIVITY_PATH = /^\/feed\/update\/urn:li:activity:\d+\/?$/i
const POST_PATH = /^\/posts\/[^/]+\/?$/i

function normalizeLinkedInPostUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  try {
    const parsed = new URL(value.trim())
    const isLinkedInHost = parsed.hostname === 'linkedin.com' || parsed.hostname === 'www.linkedin.com'
    const isPostPath = ACTIVITY_PATH.test(parsed.pathname) || POST_PATH.test(parsed.pathname)
    if (
      parsed.protocol !== 'https:'
      || !isLinkedInHost
      || !isPostPath
      || parsed.port
      || parsed.username
      || parsed.password
    ) return undefined

    parsed.hostname = 'www.linkedin.com'
    parsed.pathname = parsed.pathname.replace(/\/$/, '')
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function boundedDimension(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(minimum, Math.min(Math.round(value), maximum))
}

function normalizeEmbed(value: unknown): LinkedInEmbedData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.provider !== 'linkedin' || typeof data.url !== 'string') return null

  try {
    const parsed = new URL(data.url.trim())
    const isLinkedInHost = parsed.hostname === 'linkedin.com' || parsed.hostname === 'www.linkedin.com'
    if (
      parsed.protocol !== 'https:'
      || !isLinkedInHost
      || !EMBED_PATH.test(parsed.pathname)
      || parsed.port
      || parsed.username
      || parsed.password
    ) return null

    const queryEntries = [...parsed.searchParams.entries()]
    if (
      queryEntries.length > 1
      || (queryEntries.length === 1
        && (queryEntries[0][0] !== 'collapsed' || queryEntries[0][1] !== '0'))
    ) return null

    parsed.hostname = 'www.linkedin.com'
    parsed.pathname = parsed.pathname.replace(/\/$/, '')
    parsed.search = queryEntries.length ? 'collapsed=0' : ''
    parsed.hash = ''

    return {
      url: parsed.toString(),
      postUrl: normalizeLinkedInPostUrl(data.post_url),
      title: typeof data.title === 'string' && data.title.trim()
        ? data.title.trim().slice(0, 160)
        : 'LinkedIn post',
      width: boundedDimension(data.width, 504, 280, 1200),
      height: boundedDimension(data.height, 900, 320, 1800),
    }
  } catch {
    return null
  }
}

export function extractLinkedInEmbeds(content: string): {
  text: string
  embeds: LinkedInEmbedData[]
} {
  const embeds: LinkedInEmbedData[] = []
  const seen = new Set<string>()
  const text = content.replace(DIRECTIVE_PATTERN, (_directive, raw: string) => {
    try {
      const embed = normalizeEmbed(JSON.parse(raw))
      if (embed && !seen.has(embed.url)) {
        seen.add(embed.url)
        embeds.push(embed)
      }
    } catch {
      // Directives are transport metadata. Never render malformed or untrusted payloads as text.
    }
    return ''
  }).trim()

  return { text, embeds }
}

export function LinkedInEmbeds({ embeds }: { embeds: LinkedInEmbedData[] }) {
  if (!embeds.length) return null

  return (
    <div className="flex w-full flex-col gap-3">
      {embeds.map(embed => (
        <div
          key={embed.url}
          className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
          style={{ maxWidth: embed.width }}
        >
          <iframe
            src={embed.url}
            title={embed.title}
            width={embed.width}
            height={embed.height}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block w-full border-0"
          />
          {embed.postUrl && (
            <a
              href={embed.postUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="block border-t border-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Open this post on LinkedIn
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
