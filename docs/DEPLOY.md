# Deploy: SDK → npm → oo-chat → Vercel

oo-chat depends on the ConnectOnion TypeScript SDK, which lives in **separate repos**.
A change to the SDK only reaches production once it's published to npm and oo-chat is
bumped to that version. This is the full chain.

## Two packages

Since SDK 0.2.0 the SDK is two npm packages, and oo-chat depends on both:

| Package | Repo | What oo-chat uses it for |
|---------|------|--------------------------|
| `connectonion` | `openonion/connectonion-ts` | Connection, WebSocket protocol, types. Also a peer dependency of the package below. |
| `@connectonion/react` | `openonion/connectonion-react` | `useAgentForHuman`, `useVoiceInput`, `fetchAgentInfo` — what the components import. |

> Until `connectonion-react` exists, `@connectonion/react` is staged inside
> `connectonion-ts` at `packages/react/`, so "publish the React package" means
> tagging from that directory. Everything below is written for the split repos;
> substitute the path while it's still staged.

`@connectonion/react` declares `connectonion` as a **peer** dependency, so the two
versions must be compatible — bump them together and keep the majors/minors aligned
unless you have a reason not to.

## The dependency, two ways

`oo-chat/package.json` declares `"connectonion": "^0.2.x"` and
`"@connectonion/react": "^0.2.x"` — **published npm versions** (this is what Vercel
installs and builds against).

For local development, both are symlinked so SDK edits show up immediately:

```
node_modules/connectonion       -> ../../connectonion-ts
node_modules/@connectonion/react -> ../../connectonion-react
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

### 1. Publish the core SDK (`../connectonion-ts`)

Core goes first — `@connectonion/react` builds against it.

```bash
cd ../connectonion-ts
./node_modules/.bin/tsc                       # type-check
npx jest tests/connect.test.ts --forceExit    # tests must pass

# bump version in package.json (e.g. 0.2.0 → 0.2.1), then:
git add -A && git commit -m "v0.2.1"
git tag v0.2.1
git push origin main && git push origin v0.2.1
```

Pushing the **`v*` tag** triggers `.github/workflows/publish.yml`, which builds and
publishes `connectonion` to npm. Watch it:

```bash
gh run watch --repo openonion/connectonion-ts --exit-status
npm view connectonion version          # should show the new version
```

### 2. Publish the React package (`../connectonion-react`)

Skip this step if the change was core-only and the hooks are untouched — just leave
`@connectonion/react` at its current version.

```bash
cd ../connectonion-react
npm pkg set peerDependencies.connectonion="^0.2.1"   # only if core's range moved
npx tsc --noEmit
npx jest

# bump version in package.json, then:
git add -A && git commit -m "v0.2.1"
git tag v0.2.1
git push origin main && git push origin v0.2.1

gh run watch --repo openonion/connectonion-react --exit-status
npm view @connectonion/react version
```

### 3. Point oo-chat at the published versions

```bash
cd ../oo-chat
npm pkg set dependencies.connectonion="^0.2.1"
npm pkg set 'dependencies.@connectonion/react'="^0.2.1"
npm install                            # updates package-lock.json to the registry tarballs
npm run build                          # MUST pass — this is what Vercel will run
```

`npm install` will fail loudly if the two versions violate the peer range — that check
is the point of the peer dependency, so fix the versions rather than forcing past it.

### 4. Ship oo-chat

```bash
git add package.json package-lock.json
git commit -m "Update connectonion + @connectonion/react to v0.2.1"
git push                               # push the branch; merge the PR to main
```

Vercel auto-deploys: a branch push builds a **preview**; a merge to `main` builds
**production**. Confirm the deploy is green before calling it done.

### 5. Restore the local dev symlinks (don't commit)

Production `package.json` keeps the semvers (`^0.2.1`). For local SDK work, restore
the symlinks in `node_modules` only:

```bash
rm -rf node_modules/connectonion
ln -s ../../connectonion-ts node_modules/connectonion

rm -rf node_modules/@connectonion/react
mkdir -p node_modules/@connectonion
ln -s ../../../connectonion-react node_modules/@connectonion/react
```

`package.json` stays at `^0.2.1` (committed); only `node_modules` points at the local
SDK. Don't commit `file:../connectonion-ts` dependencies.

> A symlinked `@connectonion/react` resolves `connectonion` through oo-chat's
> `node_modules` — which is itself symlinked to your working core. So local builds see
> your working copy of *both*, which is exactly the trap in the warning above, doubled.

## Automation

The skill `connectonion:deploy-oo-chat` automates steps 1–5. The `meta` is: publish
`connectonion-ts` (and `connectonion-react` when the hooks changed) to npm via GitHub
Actions, update the oo-chat dependencies, commit, push, and verify the Vercel deploy.

## Map

| Thing | Value |
|-------|-------|
| Core SDK repo | `openonion/connectonion-ts` |
| React SDK repo | `openonion/connectonion-react` (staged at `connectonion-ts/packages/react` until it exists) |
| oo-chat repo | `openonion/oo-chat` |
| npm packages | `connectonion`, `@connectonion/react` |
| Vercel project | `oo-chat` |
| Publish trigger | git tag `v*` in either SDK repo → GitHub Actions → npm |
| Deploy trigger | push to `main` → Vercel production; branch push → preview |
| Dev dependency | symlinks `node_modules/connectonion → ../connectonion-ts`, `node_modules/@connectonion/react → ../connectonion-react` |
| Prod dependency | `"connectonion": "^X.Y.Z"` + `"@connectonion/react": "^X.Y.Z"` in `package.json` |
