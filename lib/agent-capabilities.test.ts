import { expect, test } from 'vitest'
import { publicCapabilities } from './agent-capabilities'

test('shows concrete published work while excluding internal or undescribed skills', () => {
  expect(publicCapabilities([
    { name: 'debug_dump', description: 'Internal state' },
    { name: 'linkedin-login', description: 'Collect credentials for a browser session.' },
    { name: 'discover-sydney-events', description: 'Discover and verify public events in Greater Sydney. Use this for finding new events.' },
    { name: 'empty', description: '' },
    { name: 'triage_inbox', description: 'Review inbox messages and summarize action items.' },
  ])).toEqual([
    { name: 'discover-sydney-events', title: 'Discover Sydney Events', summary: 'Discover and verify public events in Greater Sydney.' },
    { name: 'triage_inbox', title: 'Triage Inbox', summary: 'Review inbox messages and summarize action items.' },
  ])
})

test('an absent profile makes no capability claim', () => {
  expect(publicCapabilities(null)).toEqual([])
  expect(publicCapabilities([{ name: 'unnamed' }])).toEqual([])
})

test('Chinese descriptions stop after the first concrete sentence', () => {
  expect(publicCapabilities([{ name: 'house-overview', description: '查看房源资料和近期经营指标，生成运营简报。用于查看最新情况。' }]))
    .toEqual([{ name: 'house-overview', title: 'House Overview', summary: '查看房源资料和近期经营指标，生成运营简报。' }])
})

test('summaries addressed to the model are rewritten for the person reading the profile', () => {
  // Real descriptions from a live agent: they are routing hints for the model, so a
  // visitor read "Use when the user wants to…", literal backticks and a "(user)" tag.
  const summaries = publicCapabilities([
    { name: 'oo-init', description: 'Use when the user wants to start, scaffold, or create their `oo` publishable identity.' },
    { name: 'content-quality', description: 'LayeredVisions content quality workflow — ANALYZE/FIX/VALIDATE modes with writing rules and quality standards (user)' },
    { name: 'triage', description: 'Use this skill when the user asks to review inbox messages.' },
  ]).map(c => c.summary)
  expect(summaries).toEqual([
    'Start, scaffold, or create your oo publishable identity.',
    'LayeredVisions content quality workflow — ANALYZE/FIX/VALIDATE modes with writing rules and quality standards',
    'Review inbox messages.',
  ])
})
