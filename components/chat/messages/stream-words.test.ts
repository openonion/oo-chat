import { describe, expect, it } from 'vitest'
import { FRESH_MS, rehypeStreamWords, words, type FirstSeen } from './stream-words'

type Node = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Node[] }

const text = (value: string): Node => ({ type: 'text', value })
const el = (tagName: string, children: Node[]): Node => ({ type: 'element', tagName, children })
const spans = (node: Node): Node[] => [
  ...(node.tagName === 'span' && (node.properties?.className as string[] | undefined)?.includes('stream-word') ? [node] : []),
  ...(node.children ?? []).flatMap(spans),
]
const className = (node: Node) => (node.properties?.className as string[]).join(' ')

describe('stream words', () => {
  it('splits by word in any language, keeping whitespace', () => {
    expect(words('Hello brave world').filter(w => w.trim())).toEqual(['Hello', 'brave', 'world'])
    // Chinese has no spaces between words; a sentence must not blur in as one block.
    expect(words('我们今天去北京').filter(w => w.trim()).length).toBeGreaterThan(1)
  })

  it('wraps each word of a paragraph and leaves code untouched', () => {
    const tree = el('root', [el('p', [text('Run the build')]), el('pre', [el('code', [text('npm run build')])])])
    rehypeStreamWords({ firstSeen: [], now: () => 0 })(tree)
    const wrapped = spans(tree)
    expect(wrapped.map(s => s.children?.[0].value)).toEqual(['Run', 'the', 'build'])
    expect(JSON.stringify(tree.children?.[1])).toContain('npm run build')
  })

  it('marks only the words that arrived in the last moment as fresh', () => {
    const firstSeen: FirstSeen = []
    let clock = 1000
    const step = () => rehypeStreamWords({ firstSeen, now: () => clock })
    const first = el('root', [el('p', [text('One two')])])
    step()(first)
    expect(spans(first).map(className)).toEqual(['stream-word is-fresh', 'stream-word is-fresh'])

    clock += FRESH_MS + 1
    const grown = el('root', [el('p', [text('One two three')])])
    step()(grown)
    expect(spans(grown).map(className)).toEqual(['stream-word', 'stream-word', 'stream-word is-fresh'])
  })

  it('keeps a word fresh across a delta that lands mid-animation', () => {
    const firstSeen: FirstSeen = []
    let clock = 0
    rehypeStreamWords({ firstSeen, now: () => clock })(el('root', [el('p', [text('Alpha')])]))
    clock = 100
    const next = el('root', [el('p', [text('Alpha beta')])])
    rehypeStreamWords({ firstSeen, now: () => clock })(next)
    expect(spans(next).map(className)).toEqual(['stream-word is-fresh', 'stream-word is-fresh'])
  })
})
