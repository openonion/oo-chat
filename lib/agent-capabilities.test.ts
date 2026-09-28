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
