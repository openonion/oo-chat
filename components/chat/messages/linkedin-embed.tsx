interface LinkedInEmbedData {
  url: string
  postUrl?: string
  title: string
  width: number
  height: number
}

const DIRECTIVE_PATTERN = /\[\[linkedin_embed\]\]([\s\S]*?)\[\[\/linkedin_embed\]\]/g
const EMBED_PATH = /^\/embed\/feed\/update\/urn:li:(activity|share|ugcPost):\d+\/?$/i

function normalizeLinkedInPostUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = new URL(value)
    if (
      parsed.protocol !== 'https:'
      || (parsed.hostname !== 'www.linkedin.com' && parsed.hostname !== 'linkedin.com')
      || parsed.username
      || parsed.password
    ) return undefined
    parsed.hostname = 'www.linkedin.com'
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function normalizeEmbed(value: unknown): LinkedInEmbedData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.provider !== 'linkedin' || typeof data.url !== 'string') return null

  try {
    const parsed = new URL(data.url)
    if (
      parsed.protocol !== 'https:'
      || parsed.hostname !== 'www.linkedin.com'
      || parsed.username
      || parsed.password
      || !EMBED_PATH.test(parsed.pathname)
    ) return null
    for (const key of parsed.searchParams.keys()) {
      if (key !== 'collapsed') return null
    }
    const collapsed = parsed.searchParams.get('collapsed')
    if (collapsed !== null && collapsed !== '0' && collapsed !== '1') return null
    parsed.hash = ''

    return {
      url: parsed.toString(),
      postUrl: normalizeLinkedInPostUrl(data.post_url),
      title: typeof data.title === 'string' && data.title.trim()
        ? data.title.trim().slice(0, 160)
        : 'LinkedIn post',
      width: Math.max(280, Math.min(Number(data.width) || 504, 1200)),
      height: Math.max(320, Math.min(Number(data.height) || 900, 1800)),
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
  const text = content.replace(DIRECTIVE_PATTERN, (_directive, raw: string) => {
    try {
      const embed = normalizeEmbed(JSON.parse(raw))
      if (embed) embeds.push(embed)
    } catch {
      // Invalid or untrusted directives are omitted instead of rendered as HTML.
    }
    return ''
  }).trim()
  return { text, embeds }
}

export function LinkedInEmbeds({ embeds }: { embeds: LinkedInEmbedData[] }) {
  if (!embeds.length) return null
  return (
    <div className="flex w-full flex-col gap-3">
      {embeds.map((embed) => (
        <div
          key={embed.url}
          className="w-full max-w-[504px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
        >
          <iframe
            src={embed.url}
            title={embed.title}
            width={embed.width}
            height={embed.height}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups"
            allowFullScreen
            className="block min-h-[420px] w-full border-0"
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
