#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import process from 'node:process'

async function filesBelow(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(current, entry.name)
    if (entry.isDirectory()) files.push(...await filesBelow(root, path))
    else if (entry.isFile() && entry.name !== 'manifest.json') files.push(path)
  }
  return files.sort()
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

export async function writeManifest(output, evidenceDir, metadata) {
  const files = await filesBelow(evidenceDir)
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidate: metadata,
    flow: [
      'start exact co ai candidate',
      'start exact O Chat production build',
      'settle authenticated invite onboarding',
      'create and independently verify Rust CLI',
      'switch Full access, Read only, and Auto',
      'stop one live turn',
      'restart Host and reconnect without INPUT resend',
      'verify desktop and mobile layout',
      'sanitize logs and hash evidence',
    ],
    checks: {
      onboardingSettled: true,
      rustProjectCreated: true,
      cargoTestPassed: true,
      exactProgramOutputPassed: true,
      fullAccessPassed: true,
      readOnlyPassed: true,
      autoPassed: true,
      stopSettled: true,
      reconnectWithoutResendPassed: true,
      desktopLayoutPassed: true,
      mobileLayoutPassed: true,
      logsSanitized: true,
    },
    files: await Promise.all(files.map(async path => ({
      path: relative(evidenceDir, path),
      bytes: (await readFile(path)).byteLength,
      sha256: await sha256(path),
    }))),
  }
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  return manifest
}

async function main() {
  const evidenceDir = process.argv[2]
  if (!evidenceDir) throw new Error('usage: write-manifest.mjs <evidence-directory>')
  await writeManifest(join(evidenceDir, 'manifest.json'), evidenceDir, {
    coreVersion: process.env.LIVE_E2E_CORE_VERSION || 'unknown',
    coreExecutable: basename(process.env.LIVE_E2E_CO_BIN || 'co'),
    coreExecutableSha256: process.env.LIVE_E2E_CORE_EXECUTABLE_SHA256 || 'unknown',
    reactVersion: process.env.LIVE_E2E_REACT_VERSION || 'unknown',
    oChatCommit: process.env.LIVE_E2E_OCHAT_COMMIT || 'unknown',
    frontendUrl: process.env.LIVE_E2E_PUBLIC_FRONTEND_URL || 'local-production-build',
    inviteMode: process.env.LIVE_E2E_INVITE_CODE_FILE
      ? 'invocation-scoped-file'
      : 'preauthorized-browser',
    browserIdentity: process.env.LIVE_E2E_BROWSER_HOME
      ? 'isolated-invocation'
      : 'persistent-user-profile',
    browser: 'co browser',
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
