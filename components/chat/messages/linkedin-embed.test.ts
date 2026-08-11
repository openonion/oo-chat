import { describe, expect, test } from 'vitest'
import { extractLinkedInEmbeds } from './linkedin-embed'

function directive(payload: Record<string, unknown>): string {
  return `[[linkedin_embed]]${JSON.stringify(payload)}[[/linkedin_embed]]`
}

describe('LinkedIn embed directives', () => {
  test('extracts and canonicalizes a valid full-post embed', () => {
    const content = [
      'Here is the complete post.',
      directive({
        provider: 'linkedin',
        url: 'https://linkedin.com/embed/feed/update/urn:li:ugcPost:123/?collapsed=0#fragment',
        post_url: 'https://linkedin.com/posts/jinpeng_activity-123?trackingId=abc#comments',
        title: '  LinkedIn embedded post  ',
        width: 503.6,
        height: 960,
      }),
    ].join('\n\n')

    expect(extractLinkedInEmbeds(content)).toEqual({
      text: 'Here is the complete post.',
      embeds: [{
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:123?collapsed=0',
        postUrl: 'https://www.linkedin.com/posts/jinpeng_activity-123',
        title: 'LinkedIn embedded post',
        width: 504,
        height: 960,
      }],
    })
  })

  test.each([
    'http://www.linkedin.com/embed/feed/update/urn:li:activity:123',
    'https://www.linkedin.com.evil.example/embed/feed/update/urn:li:activity:123',
    'https://evil.linkedin.com/embed/feed/update/urn:li:activity:123',
    'https://user@www.linkedin.com/embed/feed/update/urn:li:activity:123',
    'https://www.linkedin.com:444/embed/feed/update/urn:li:activity:123',
    'https://www.linkedin.com/feed/update/urn:li:activity:123',
    'https://www.linkedin.com/embed/feed/update/urn:li:activity:123?collapsed=1',
    'https://www.linkedin.com/embed/feed/update/urn:li:activity:123?theme=dark',
    'https://www.linkedin.com/embed/feed/update/urn:li:activity:123?collapsed=0&collapsed=0',
  ])('rejects an untrusted or unsupported embed URL: %s', url => {
    const result = extractLinkedInEmbeds(`Keep me\n\n${directive({ provider: 'linkedin', url })}`)

    expect(result).toEqual({ text: 'Keep me', embeds: [] })
  })

  test('removes malformed transport directives without exposing them as chat text', () => {
    const result = extractLinkedInEmbeds('Visible\n\n[[linkedin_embed]]not-json[[/linkedin_embed]]')

    expect(result).toEqual({ text: 'Visible', embeds: [] })
  })

  test.each(['share', 'ugcPost'])('keeps a supported %s full-post link', urnType => {
    const result = extractLinkedInEmbeds(directive({
      provider: 'linkedin',
      url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:123',
      post_url: `https://www.linkedin.com/feed/update/urn:li:${urnType}:456?trackingId=abc`,
    }))

    expect(result.embeds[0].postUrl).toBe(
      `https://www.linkedin.com/feed/update/urn:li:${urnType}:456`,
    )
  })

  test('bounds dimensions, defaults metadata, and de-duplicates repeated embeds', () => {
    const payload = {
      provider: 'linkedin',
      url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:456',
      post_url: 'https://www.linkedin.com/in/not-a-post',
      width: 10,
      height: 9999,
    }
    const repeated = directive(payload)
    const result = extractLinkedInEmbeds(`${repeated}\n${repeated}`)

    expect(result).toEqual({
      text: '',
      embeds: [{
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:456',
        postUrl: undefined,
        title: 'LinkedIn post',
        width: 280,
        height: 1800,
      }],
    })
  })
})
