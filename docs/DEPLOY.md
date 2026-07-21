# Deploy: SDK → npm → oo-chat → Vercel

oo-chat depends on the `connectonion` TypeScript SDK, which lives in a **separate
repo** (`../connectonion-ts`, GitHub `openonion/connectonion-ts`). A change to the
SDK only reaches production once it's published to npm and oo-chat is bumped to that
version. This is the full chain.

## The dependency, two ways

`oo-chat/package.json` declares `"connectonion": "^0.1.x"` — a **published npm
version** (this is what Vercel installs and builds against).

For local development, `node_modules/connectonion` is symlinked to
`../connectonion-ts` so SDK edits show up immediately:

```
node_modules/connectonion -> ../../connectonion-ts
```

> ⚠️ **Local builds can pass while Vercel fails.** The symlink points at your
> *working* SDK, which may contain unpublished changes. Vercel installs the
> *published* semver. If oo-chat uses an SDK symbol that isn't in the published
> version yet, `npm run build` is green locally but Vercel errors with a TypeScript
> "no overlap" / missing-export error. The fix is always: publish the SDK first,
> then bump oo-chat. (This is exactly what bit `RemoteSessionStatus = 'running'` —
> it existed only in the local SDK until `connectonion@0.1.6` shipped.)

## Versioning

Increment the patch by 1; when a segment would hit two digits, roll up:

```
0.1.5 → 0.1.6    0.1.9 → 0.2.0    0.9.9 → 1.0.0
```

## Steps

### 1. Publish the SDK (`../connectonion-ts`)

```bash
cd ../connectonion-ts
./node_modules/.bin/tsc                       # type-check
npx jest tests/connect.test.ts --forceExit    # tests must pass

# bump version in package.json (e.g. 0.1.5 → 0.1.6), then:
git add -A && git commit -m "v0.1.6"
git tag v0.1.6
git push origin main && git push origin v0.1.6
```

Pushing the **`v*` tag** triggers `.github/workflows/publish.yml`, which builds and
publishes `connectonion` to npm. Watch it:

```bash
gh run watch --repo openonion/connectonion-ts --exit-status
npm view connectonion version          # should show the new version
```

### 2. Point oo-chat at the published version

```bash
cd ../oo-chat
npm pkg set dependencies.connectonion="^0.1.6"
npm install                            # updates package-lock.json to the registry tarball
npm run build                          # MUST pass — this is what Vercel will run
```

### 3. Ship oo-chat

```bash
git add package.json package-lock.json
git commit -m "Update connectonion to v0.1.6"
git push                               # push the branch; merge the PR to main
```

Vercel auto-deploys: a branch push builds a **preview**; a merge to `main` builds
**production**. Confirm the deploy is green before calling it done.

### 4. Restore the local dev symlink (don't commit)

Production `package.json` keeps the semver (`^0.1.6`). For local SDK work, restore
the symlink in `node_modules` only:

```bash
rm -rf node_modules/connectonion
ln -s ../../connectonion-ts node_modules/connectonion
```

`package.json` stays at `^0.1.6` (committed); only `node_modules` points at the local
SDK. Don't commit a `file:../connectonion-ts` dependency.

## Automation

The skill `connectonion:deploy-oo-chat` automates steps 1–4. The `meta` is: publish
`connectonion-ts` to npm via GitHub Actions, update the oo-chat dependency, commit,
push, and verify the Vercel deploy.

## Map

| Thing | Value |
|-------|-------|
| SDK repo | `openonion/connectonion-ts` |
| oo-chat repo | `openonion/oo-chat` |
| npm package | `connectonion` |
| Vercel project | `oo-chat` |
| Publish trigger | git tag `v*` → GitHub Actions → npm |
| Deploy trigger | push to `main` → Vercel production; branch push → preview |
| Dev dependency | symlink `node_modules/connectonion → ../connectonion-ts` |
| Prod dependency | `"connectonion": "^X.Y.Z"` in `package.json` |
