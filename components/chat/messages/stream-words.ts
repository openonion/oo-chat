/**
 * Streaming text arrives as one growing string, and react-markdown re-renders the
 * whole reply on every delta. Without help a new word simply pops in, and the eye
 * has to find where the reply grew. This rehype step wraps each word of a reply
 * that is still streaming in a span and marks the words that arrived in the last
 * moment as fresh, so CSS can blur them in (`.stream-word.is-fresh` in
 * app/globals.css). Only blur and opacity move: nothing changes size, so the
 * reply never jumps while it grows.
 *
 * "Fresh" is by time, not by "new since the last render": a delta that lands
 * mid-animation must not strip the class from the words still settling, and a
 * markdown restructure that remounts older words must not replay them.
 *
 * Code stays untouched (inside `pre` / `code`), and the step only runs while the
 * reply streams; a finished reply renders as plain markdown.
 */

/** The parts of a hast node this step reads or writes. */
type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/** How long a word counts as fresh, a little longer than its CSS animation. */
export const FRESH_MS = 450

/** Word boundaries in any language: Chinese and Japanese have no spaces between
 *  words, so a whitespace split would blur a whole sentence in as one block. */
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : null

export function words(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), part => part.segment)
  return text.split(/(\s+)/).filter(Boolean)
}

/** When each word index first appeared, in ms. Owned by one streaming reply. */
export type FirstSeen = number[]

export function rehypeStreamWords(options: { firstSeen: FirstSeen; now?: () => number }) {
  const clock = options.now ?? Date.now
  return (tree: HastNode) => {
    const now = clock()
    let index = 0
    const visit = (node: HastNode, insideCode: boolean) => {
      if (!node.children) return
      const out: HastNode[] = []
      for (const child of node.children) {
        if (child.type === 'text' && !insideCode) {
          for (const part of words(child.value ?? '')) {
            if (!part.trim()) {
              out.push({ type: 'text', value: part })
              continue
            }
            const i = index++
            if (options.firstSeen[i] === undefined) options.firstSeen[i] = now
            const fresh = now - options.firstSeen[i] < FRESH_MS
            out.push({
              type: 'element',
              tagName: 'span',
              properties: { className: fresh ? ['stream-word', 'is-fresh'] : ['stream-word'] },
              children: [{ type: 'text', value: part }],
            })
          }
        } else {
          visit(child, insideCode || child.tagName === 'pre' || child.tagName === 'code')
          out.push(child)
        }
      }
      node.children = out
    }
    visit(tree, false)
  }
}
