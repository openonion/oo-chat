#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

const ANSI_ESCAPE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g
const AGENT_ADDRESS = /\b0x[0-9a-f]{12,}(?:\.\.\.)?/gi
const BALANCE = /\bbalance:\s*\$[0-9]+(?:\.[0-9]{1,2})?/gi
const POSIX_PRIVATE_PATH = /\/(?:Users|home|private|tmp|var\/folders)\/[A-Za-z0-9._~+/@%:=,-]+(?:\/[A-Za-z0-9._~+/@%:=,-]+)*/g
const WINDOWS_PRIVATE_PATH = /\b[A-Za-z]:\\(?:Users|Temp|Windows\\Temp)\\[^\s'"<>]+/gi
const AUTH_HEADER = /\b(authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi
const NAMED_SECRET = /\b(invite(?:_code)?|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[=:]\s*[^\s,;]+/gi
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi

function literalPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
}

export function sanitizeLog(raw, { workspace = '', home = '', secrets = [] } = {}) {
  let value = String(raw).replace(ANSI_ESCAPE, '')
  const exactValues = [workspace, home, ...secrets]
    .map(candidate => String(candidate || '').trim())
    .filter(candidate => candidate.length >= 4 && candidate !== '/')
    .sort((left, right) => right.length - left.length)

  for (const exact of exactValues) {
    value = value.replace(
      literalPattern(exact),
      exact === workspace ? '[WORKSPACE]' : exact === home ? '[HOME]' : '[REDACTED_SECRET]',
    )
  }

  return value
    .replace(AUTH_HEADER, '$1: [REDACTED]')
    .replace(NAMED_SECRET, '$1=[REDACTED]')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(AGENT_ADDRESS, '[AGENT_ADDRESS]')
    .replace(BALANCE, 'balance: [REDACTED]')
    .replace(WINDOWS_PRIVATE_PATH, '[PRIVATE_PATH]')
    .replace(POSIX_PRIVATE_PATH, '[PRIVATE_PATH]')
}

async function secretValues(path) {
  if (!path) return []
  const contents = await readFile(path, 'utf8')
  return contents
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(value => value && !value.startsWith('#'))
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    throw new Error('usage: sanitize-evidence.mjs <raw-log> <sanitized-log>')
  }
  const secrets = await secretValues(process.env.LIVE_E2E_SECRET_VALUES_FILE)
  const raw = await readFile(input, 'utf8')
  const sanitized = sanitizeLog(raw, {
    workspace: process.env.LIVE_E2E_WORKSPACE,
    home: process.env.HOME,
    secrets,
  })

  for (const forbidden of [process.env.LIVE_E2E_WORKSPACE, ...secrets]) {
    if (forbidden && forbidden.length >= 4 && sanitized.includes(forbidden)) {
      throw new Error('sanitized evidence still contains a configured private value')
    }
  }
  await writeFile(output, sanitized, { mode: 0o600 })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
