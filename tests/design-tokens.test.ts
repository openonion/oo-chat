import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Components name a ROLE from app/globals.css (accent, danger, warning, success,
// info, the neutral ramp, text-meta/ui/body), never a raw palette hue, a hex
// value, a mouse-visible focus style or `transition-all` (oo-chat#278, PR 1).
// Each rule lists the offending file:line so a regression is a one-line fix.

const ROOT = join(__dirname, '..')
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const files = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)))

function offenders(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (pattern.test(line)) hits.push(`${relative(ROOT, file)}:${index + 1}`)
      })
  }
  return hits
}

// Any utility prefix, including side variants (border-l-, ring-offset-, divide-x-…).
const UTILITY = '[a-z]+(?:-[a-z]+)*'
const HUES =
  '(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone)'

describe('design tokens', () => {
  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('uses role colours, never a raw palette hue', () => {
    expect(offenders(new RegExp(`\\b${UTILITY}-${HUES}-\\d{2,3}\\b`))).toEqual([])
  })

  it('never writes a hex colour into a class', () => {
    expect(offenders(new RegExp(`\\b${UTILITY}-\\[#[0-9a-fA-F]{3,8}\\]`))).toEqual([])
  })

  it('shows focus styles for keyboard focus only (focus-visible, not focus)', () => {
    expect(offenders(/(?<![\w-])focus:[a-z[!-]/)).toEqual([])
  })

  it('transitions named properties, never all of them', () => {
    expect(offenders(/\btransition-all\b/)).toEqual([])
  })

  it('puts 700+ text on a tinted fill (500/600 is unreadable on the dark tint)', () => {
    expect(
      offenders(/\bbg-(?:danger|warning|success|info)-(?:50|100)\b[^"'`]*\btext-(?:danger|warning|success|info)-(?:[1-6]00)\b/),
    ).toEqual([])
  })

  it('takes 11/13/15px text from the type pair (text-meta, text-ui, text-body)', () => {
    expect(offenders(/\btext-\[(?:11|13|15)px\]/)).toEqual([])
  })
})
