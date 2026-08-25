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
  const reconnectOnly = process.env.LIVE_E2E_RECONNECT_ONLY === 'true'
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidate: metadata,
    flow: reconnectOnly ? [
      'start exact co ai candidate with an isolated project identity',
      'start exact O Chat production build',
      'settle authenticated invite onboarding',
      'complete one exact bounded message',
      'restart Host and reconnect without INPUT resend',
      'verify mobile layout',
      'sanitize logs and hash evidence',
    ] : [
      'start exact co ai candidate',
      'start exact O Chat production build',
      'settle authenticated invite onboarding',
      'search a deterministic catalog and download its artifact through the isolated browser daemon',
      'create and independently verify a strict C11 project',
      'create and independently verify a strict C++20 project',
      'create and independently verify Rust CLI',
      'delegate a second C11 project to native Codex, inspect its Workroom, verify confirmed Full Access, then prove outer-ceiling downgrade and denial',
      'stop a live native Codex follow-up without interrupting the outer Agent',
      'verify Codex and Claude Code Work Room voice controls and recover a provider-only draft after microphone denial',
      'delegate a third C11 project to native Claude Code, inspect its Workroom, and continue the same provider session',
      'stop a live native Claude Code follow-up without interrupting the outer Agent',
      'switch Full access, Read only, and Auto',
      'stop one live turn',
      'restart Host and reconnect without INPUT resend',
      'verify desktop and mobile layout',
      'sanitize logs and hash evidence',
    ],
    checks: reconnectOnly ? {
      onboardingSettled: true,
      exactMessagePassed: true,
      reconnectWithoutResendPassed: true,
      mobileLayoutPassed: true,
      logsSanitized: true,
      uiReviewPassed: false,
    } : {
      onboardingSettled: true,
      browserTaskPassed: true,
      browserToolEvidencePassed: true,
      browserSearchPassed: true,
      browserDownloadPassed: true,
      cProjectCreated: true,
      cStrictCompilePassed: true,
      cFixturesPassed: true,
      cppProjectCreated: true,
      cppStrictCompilePassed: true,
      cppFixturesPassed: true,
      rustProjectCreated: true,
      cargoTestPassed: true,
      exactProgramOutputPassed: true,
      nativeCodexDelegationPassed: true,
      codexStrictCompilePassed: true,
      codexWorkroomConversationPassed: true,
      codexWorkroomVoiceControlPassed: true,
      codexWorkroomVoiceRecoveryPassed: true,
      codexDesktopTabletMobilePassed: true,
      codexProviderPermissionCatalogPassed: true,
      codexProviderPermissionAckPassed: true,
      providerPermissionOuterModePreserved: true,
      codexProviderFullAccessConfirmedPassed: true,
      codexProviderStopPassed: true,
      codexProviderCeilingDowngradePassed: true,
      codexProviderFullAccessDeniedPassed: true,
      codexPermissionDesktopMobilePassed: true,
      nativeClaudeCodeDelegationPassed: true,
      claudeStrictCompilePassed: true,
      claudeWorkroomConversationPassed: true,
      claudeWorkroomVoiceControlPassed: true,
      claudeProviderFollowUpPassed: true,
      claudeProviderStopPassed: true,
      claudeDesktopMobilePassed: true,
      fullAccessPassed: true,
      readOnlyPassed: true,
      autoPassed: true,
      stopSettled: true,
      reconnectWithoutResendPassed: true,
      desktopLayoutPassed: true,
      mobileLayoutPassed: true,
      logsSanitized: true,
      uiReviewPassed: false,
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
    codexVersion: process.env.LIVE_E2E_CODEX_VERSION || 'unknown',
    claudeCodeVersion: process.env.LIVE_E2E_CLAUDE_CODE_VERSION || 'unknown',
    frontendUrl: process.env.LIVE_E2E_PUBLIC_FRONTEND_URL || 'local-production-build',
    inviteMode: process.env.LIVE_E2E_INVITE_CODE_FILE
      ? 'invocation-scoped-file'
      : 'preauthorized-browser',
    browserIdentity: process.env.LIVE_E2E_BROWSER_PROFILE_DIR
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
