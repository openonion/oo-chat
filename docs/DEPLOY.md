# Deploy: React SDK → npm → oo-chat → Vercel

oo-chat has **one SDK dependency**:

| Package | Repo | What it is |
|---|---|---|
| `@connectonion/react` | `../connectonion-react` (`openonion/connectonion-react`) | hooks, `RemoteAgent`, WebSocket protocol, browser identity, and the Zustand session store |

**oo-chat imports and installs `@connectonion/react`, not the standalone `connectonion`
TypeScript client.** The React layer used to live at `connectonion/react`; it was split
out in `connectonion@0.3.0` and that subpath no longer exists. If you are about to write
`from 'connectonion/react'`, that is the old shape — use `@connectonion/react`.

A React SDK change only reaches production once it is published to npm and oo-chat is
bumped to that version. The standalone TypeScript client is retired and is not part of
this deployment chain; do not add it back as a fallback or parallel protocol owner.

## Runtime credential boundary

`@connectonion/react` owns the browser identity as a non-extractable WebCrypto
key in IndexedDB. O Chat keeps the short-lived auth JWT and fetched account
profile in memory only and re-authenticates after reload. Neither release nor
rollback may add those values to Zustand persistence, localStorage, or
sessionStorage. The store migration deletes copies left by older alpha builds
while preserving agent addresses, conversation indexes, and SDK sessions.

## The dependency, two ways

`oo-chat/package.json` declares published npm versions — that is what Vercel installs and
builds against.

For local development it is tempting to symlink `node_modules/@connectonion/react` to
the sibling checkout so SDK edits show up immediately.

> ⚠️ **A symlinked package makes local builds pass while Vercel fails.** The symlink points
> at your *working* copy, which may contain unpublished changes; Vercel installs the
> *published* semver. If oo-chat uses a symbol that isn't published yet, `npm run build` is
> green locally and Vercel errors with a TypeScript missing-export error.
>
> This has bitten three times: `RemoteSessionStatus = 'running'` (fixed by `connectonion@0.1.6`),
> `profile` (fixed by `0.1.10`), and the React split itself. **A preview deploy is the only
> check that means anything** — a green local build against a symlink proves nothing.

## Versioning

Increment the patch by 1; when a segment would hit two digits, roll up:

```
0.2.3 → 0.2.4    0.2.9 → 0.3.0    0.9.9 → 1.0.0
```

The React SDK and oo-chat version independently. Bump oo-chat's dependency only after the
required React SDK version is published.

## Steps

### 1. Publish the React SDK

The React repository publishes when you **push a `v*` tag**.
`.github/workflows/publish.yml` verifies the tag matches `package.json`, runs the tests,
builds, and publishes to npm.

Neither repo holds an npm token. Both use **npm trusted publishing (OIDC)** — GitHub Actions
exchanges a short-lived OIDC token for publish rights, and the release carries a provenance
attestation. There is nothing to rotate and no secret to leak.

```bash
cd ../connectonion-react
npx tsc --noEmit
npx jest

# bump version in package.json, then:
git add -A && git commit -m "v0.3.4"
git tag v0.3.4
git push origin main && git push origin v0.3.4

gh run watch --repo openonion/connectonion-react --exit-status
npm view @connectonion/react version    # should show the new version
```

> The `publish.yml` in `connectonion-react` packs the tarball and installs it into a clean
> project before publishing. That gate exists because `@connectonion/react@0.2.2` went to npm
> with `peerDependencies` still pointing at a local tarball path: `tsc`, 30 tests, and the
> build were all green, and the published package was uninstallable for everyone. Nothing in
> a repo's own test suite installs the package the way a consumer does.

### 2. Point oo-chat at the published version

```bash
cd ../oo-chat
npm pkg set dependencies."@connectonion/react"="^0.4.1"
npm install                            # updates package-lock.json to the registry tarball
npm run build                          # MUST pass — this is what Vercel will run
```

Check the lockfile actually resolved from the registry, not from a path:

```bash
grep -A2 '"node_modules/@connectonion/react"' package-lock.json   # expect a registry URL
```

### 3. Ship oo-chat

```bash
git add package.json package-lock.json
git commit -m "Update @connectonion/react to v0.4.1"
git push                               # push the branch; merge the PR to main
```

Vercel auto-deploys: a branch push builds a **preview**; a merge to `main` builds
**production**. Confirm the preview is green before merging.

Before merging, require both independent gates:

- **E2E** installs the exact lockfile, audits dependencies, type-checks, lints,
  runs unit and browser tests, and keeps the screenshot/report artifacts.
  Its representative `co ai` journey types and sends a release question through
  the real discovery/WebSocket/UI stack, verifies the tool call and final answer,
  and saves both desktop and 390px-phone conversation screenshots. Onboarding
  coverage separately proves an initial invite challenge has exactly one verifier
  while a challenge raised mid-conversation stays inline with the readable thread.
- **CodeQL** analyzes all repository JavaScript and TypeScript on pull requests,
  pushes to `main`, and a weekly schedule. Review every initial alert; do not
  exclude the test tree wholesale. A test-only alert needs a precise disposition.

Both workflows complement GitHub Dependabot and `npm audit`; none replaces the
others. After the first clean CodeQL baseline, make its check required in branch
protection so a missing, running, or failed analysis cannot be merged unnoticed.

### 4. If you symlinked for local dev, undo it before committing

`package.json` must keep the semver. Only `node_modules` may point at a local checkout, and
never commit a `file:../connectonion-react` dependency — `npm i <path>` rewrites
`package.json` as a side effect, which is how the broken 0.2.2 shipped.

## Map

| Thing | Value |
|-------|-------|
| React repo | `openonion/connectonion-react` → npm `@connectonion/react` |
| oo-chat repo | `openonion/oo-chat` |
| Vercel project | `oo-chat` |
| Publish trigger | git tag `v*` → GitHub Actions → npm (OIDC, no token) |
| Deploy trigger | push to `main` → Vercel production; branch push → preview |
| What oo-chat imports | `@connectonion/react` only |
| SDK dependency | `"@connectonion/react": "^X.Y.Z"` |
