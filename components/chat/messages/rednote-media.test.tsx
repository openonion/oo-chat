import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { extractRedNoteMedia, RedNoteMediaCards } from './rednote-media'

function directive(payload: Record<string, unknown>): string {
  return `[[rednote_media]]${JSON.stringify(payload)}[[/rednote_media]]`
}

function video(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-1',
    kind: 'video',
    playable: true,
    mime_type: 'video/mp4',
    url: 'http://localhost:8000/evidence/v1/session-1/video-1?token=video-token',
    poster_url: 'http://localhost:8000/evidence/v1/session-1/poster-1?token=poster-token',
    width: 720,
    height: 1280,
    duration_ms: 12600,
    caption: 'RedNote video',
    ordinal: 1,
    ...overrides,
  }
}

function image(overrides: Record<string, unknown> = {}) {
  return {
    id: 'image-1',
    kind: 'image',
    playable: true,
    mime_type: 'image/png',
    url: 'http://localhost:8000/evidence/v1/session-1/image-1?token=image-token',
    width: 1200,
    height: 900,
    ordinal: 0,
    caption: 'First RedNote image',
    ...overrides,
  }
}

describe('RedNote media directives', () => {
  test('extracts a playable video and removes transport metadata from the message', () => {
    const result = extractRedNoteMedia([
      'Here is the selected post.',
      directive({
        provider: 'rednote',
        group_id: 'group-1',
        title: 'Morning walk',
        author: 'Nigel',
        post_url: 'https://rednote.com/explore/post-1?xsec_token=abc#comments',
        items: [video()],
        verification: {
          url: 'http://localhost:8000/evidence/v1/session-1/proof-1?token=proof-token',
          mime_type: 'image/png',
          content: 'RedNote post verification screenshot.',
        },
      }),
    ].join('\n\n'))

    expect(result.text).toBe('Here is the selected post.')
    expect(result.media).toEqual([{
      groupId: 'group-1',
      title: 'Morning walk',
      author: 'Nigel',
      postUrl: 'https://www.rednote.com/explore/post-1?xsec_token=abc',
      items: [{
        id: 'video-1',
        kind: 'video',
        url: 'http://localhost:8000/evidence/v1/session-1/video-1?token=video-token',
        mimeType: 'video/mp4',
        posterUrl: 'http://localhost:8000/evidence/v1/session-1/poster-1?token=poster-token',
        caption: 'RedNote video',
        width: 720,
        height: 1280,
        durationMs: 12600,
        ordinal: 1,
      }],
      verification: {
        url: 'http://localhost:8000/evidence/v1/session-1/proof-1?token=proof-token',
        caption: 'RedNote post verification screenshot.',
      },
    }])
  })

  test('renders native playback controls, poster, source, and post link', () => {
    const { media } = extractRedNoteMedia(directive({
      provider: 'rednote',
      group_id: 'group-1',
      title: 'Playable post',
      post_url: 'https://www.rednote.com/explore/post-1',
      items: [video()],
    }))
    const markup = renderToStaticMarkup(<RedNoteMediaCards media={media} />)

    expect(markup).toContain('<video controls=""')
    expect(markup).toContain('poster="http://localhost:8000/evidence/v1/session-1/poster-1?token=poster-token"')
    expect(markup).toContain('<source src="http://localhost:8000/evidence/v1/session-1/video-1?token=video-token" type="video/mp4"/>')
    expect(markup).toContain('Open this post on RedNote')
  })

  test('keeps image and video items in ordinal order and renders the verification image', () => {
    const { media } = extractRedNoteMedia(directive({
      provider: 'rednote',
      group_id: 'mixed-post',
      items: [video(), image()],
      verification: {
        url: 'http://localhost:8000/evidence/v1/session-1/proof-1?token=proof-token',
        mime_type: 'image/webp',
        content: 'Proof after opening the post',
      },
    }))

    expect(media[0].items.map(item => item.kind)).toEqual(['image', 'video'])
    const markup = renderToStaticMarkup(<RedNoteMediaCards media={media} />)
    expect(markup.indexOf('image-token')).toBeLessThan(markup.indexOf('video-token'))
    expect(markup).toContain('alt="First RedNote image"')
    expect(markup).toContain('Verification screenshot')
    expect(markup).toContain('alt="Proof after opening the post"')
  })

  test('renders an image-only post instead of dropping its card', () => {
    const result = extractRedNoteMedia(directive({
      provider: 'rednote',
      group_id: 'image-post',
      title: 'Photo post',
      items: [image()],
    }))

    expect(result.media).toHaveLength(1)
    expect(renderToStaticMarkup(<RedNoteMediaCards media={result.media} />)).toContain('<img')
  })

  test.each([
    video({ url: 'https://example.com/video.mp4?token=abc' }),
    video({ url: 'javascript:alert(1)' }),
    video({ url: 'http://user@localhost:8000/evidence/v1/session/video?token=abc' }),
    video({ playable: false }),
    video({ kind: 'audio' }),
    image({ mime_type: 'image/svg+xml' }),
  ])('rejects an unsafe or non-playable media item', item => {
    const result = extractRedNoteMedia(`Keep me\n${directive({
      provider: 'rednote',
      items: [item],
    })}`)

    expect(result).toEqual({ text: 'Keep me', media: [] })
  })

  test('drops malformed directives and ignores duplicate videos', () => {
    const valid = directive({
      provider: 'rednote',
      group_id: 'group-1',
      items: [video(), video()],
    })
    expect(extractRedNoteMedia(`Visible\n[[rednote_media]]bad-json[[/rednote_media]]`))
      .toEqual({ text: 'Visible', media: [] })
    expect(extractRedNoteMedia(valid).media[0].items).toHaveLength(1)
  })
})
