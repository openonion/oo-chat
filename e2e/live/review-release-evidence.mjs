#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { sanitizeLog } from './sanitize-evidence.mjs'

const REQUIRED_CHECKS = [
  'newUserExperience',
  'clientFamiliarity',
  'composerAndConversation',
  'thinkingAndWorking',
  'toolActivity',
  'responsiveLayout',
]

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fail(message) {
  throw new Error(`UI review refused: ${message}`)
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    fail(`${label} is not valid JSON (${error.message})`)
  }
}

function sortedUnique(values) {
  return [...new Set(values)].sort()
}

async function verifyManifestFiles(evidenceDir, manifest) {
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail('manifest has no hashed evidence files')
  }
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== 'string' || entry.path.includes('..')) {
      fail('manifest contains an unsafe evidence path')
    }
    const path = join(evidenceDir, entry.path)
    const value = await readFile(path)
    if (value.byteLength !== entry.bytes || sha256(value) !== entry.sha256) {
      fail(`hashed evidence changed before review: ${entry.path}`)
    }
  }
}

function validateReview(review, screenshots, generatedAt) {
  if (review.schemaVersion !== 1) fail('review schemaVersion must be 1')
  if (typeof review.reviewer !== 'string' || review.reviewer.trim().length < 3) {
    fail('reviewer identity is required')
  }
  const reviewedAt = Date.parse(review.reviewedAt)
  const evidenceGeneratedAt = Date.parse(generatedAt)
  if (Number.isNaN(reviewedAt)) fail('reviewedAt must be an ISO timestamp')
  if (Number.isNaN(evidenceGeneratedAt)) fail('manifest generatedAt is invalid')
  if (reviewedAt < evidenceGeneratedAt) fail('reviewedAt must be after the screenshots were generated')
  if (reviewedAt > Date.now() + 5 * 60_000) fail('reviewedAt cannot be in the future')

  if (!Array.isArray(review.screenshotsReviewed)) fail('screenshotsReviewed must be an array')
  const reviewed = sortedUnique(review.screenshotsReviewed)
  if (reviewed.length !== review.screenshotsReviewed.length) {
    fail('screenshotsReviewed contains a duplicate')
  }
  if (JSON.stringify(reviewed) !== JSON.stringify(screenshots)) {
    fail('screenshotsReviewed must name every hashed PNG exactly once')
  }
  for (const name of reviewed) {
    if (isAbsolute(name) || name.includes('..') || !name.endsWith('.png')) {
      fail(`invalid reviewed screenshot path: ${name}`)
    }
  }

  if (!review.checks || typeof review.checks !== 'object') fail('checks are required')
  for (const name of REQUIRED_CHECKS) {
    const check = review.checks[name]
    if (!check || check.status !== 'pass') fail(`${name} must explicitly pass`)
    if (typeof check.notes !== 'string' || check.notes.trim().length < 20) {
      fail(`${name} needs concrete review notes of at least 20 characters`)
    }
  }

  if (!Array.isArray(review.issues)) fail('issues must be an array')
  const blockers = review.issues.filter(issue =>
    ['critical', 'high'].includes(String(issue?.severity || '').toLowerCase())
    && String(issue?.status || 'open').toLowerCase() !== 'resolved')
  if (blockers.length > 0) fail('critical/high UI issues must be resolved before release')
}

async function finalizeReview(evidenceDir, reviewPath) {
  const manifestPath = join(evidenceDir, 'manifest.json')
  const manifest = await readJson(manifestPath, 'manifest')
  if (manifest.schemaVersion !== 1) fail('unsupported manifest schema')
  await verifyManifestFiles(evidenceDir, manifest)

  const screenshots = sortedUnique(
    manifest.files.map(entry => entry.path).filter(path => path.endsWith('.png')),
  )
  if (screenshots.length === 0) fail('manifest contains no screenshots to inspect')

  const review = await readJson(reviewPath, 'review')
  validateReview(review, screenshots, manifest.generatedAt)

  const canonicalReview = {
    schemaVersion: 1,
    reviewer: review.reviewer.trim(),
    reviewedAt: new Date(review.reviewedAt).toISOString(),
    screenshotsReviewed: screenshots,
    checks: Object.fromEntries(REQUIRED_CHECKS.map(name => [name, {
      status: 'pass',
      notes: review.checks[name].notes.trim(),
    }])),
    issues: review.issues,
  }
  const serializedReview = `${JSON.stringify(canonicalReview, null, 2)}\n`
  const sanitizedReview = sanitizeLog(serializedReview, {
    workspace: process.env.LIVE_E2E_WORKSPACE,
    home: process.env.HOME,
    privatePaths: [process.env.LIVE_E2E_BROWSER_PROFILE_DIR].filter(Boolean),
  })
  if (sanitizedReview !== serializedReview) {
    fail('review contains an Agent address, private path, credential, or other forbidden value')
  }
  const reviewOutput = join(evidenceDir, 'ui-review.json')
  const reviewBytes = Buffer.from(serializedReview)
  await writeFile(reviewOutput, reviewBytes, { mode: 0o600 })

  const filesWithoutReview = manifest.files.filter(entry => entry.path !== 'ui-review.json')
  const updated = {
    ...manifest,
    checks: { ...manifest.checks, uiReviewPassed: true },
    uiReview: {
      reviewer: canonicalReview.reviewer,
      reviewedAt: canonicalReview.reviewedAt,
      checks: REQUIRED_CHECKS,
    },
    files: [...filesWithoutReview, {
      path: 'ui-review.json',
      bytes: reviewBytes.byteLength,
      sha256: sha256(reviewBytes),
    }].sort((left, right) => left.path.localeCompare(right.path)),
  }
  const temporary = join(evidenceDir, `.manifest.${process.pid}.tmp`)
  await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, manifestPath)
  return updated
}

async function main() {
  const [evidenceArgument, reviewArgument] = process.argv.slice(2)
  if (!evidenceArgument || !reviewArgument) {
    throw new Error('usage: review-release-evidence.mjs <evidence-directory> <ui-review.json>')
  }
  const evidenceDir = resolve(evidenceArgument)
  const reviewPath = resolve(reviewArgument)
  const reviewRelative = relative(evidenceDir, reviewPath)
  if (reviewRelative && !reviewRelative.startsWith('..') && !isAbsolute(reviewRelative)) {
    fail('provide the review from outside the evidence directory')
  }
  const updated = await finalizeReview(evidenceDir, reviewPath)
  process.stdout.write(`UI review passed for ${updated.files.filter(file => file.path.endsWith('.png')).length} screenshots\n`)
}

export { REQUIRED_CHECKS, finalizeReview, validateReview }

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
