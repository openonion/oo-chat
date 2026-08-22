import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Keep this outside e2e/: Playwright owns that directory while Vitest owns this suite.
const scripts = join(process.cwd(), 'e2e', 'live')

describe('live release evidence helpers', () => {
  it('keeps both release shell entry points syntactically valid', () => {
    for (const name of ['run-release-candidate.sh', 'run-production-acceptance.sh']) {
      expect(() => execFileSync('bash', ['-n', join(scripts, name)])).not.toThrow()
    }
  })

  it('refuses to label a dirty O Chat worktree as an exact commit', () => {
    const runner = readFileSync(join(scripts, 'run-release-candidate.sh'), 'utf8')
    expect(runner).toContain('status --porcelain --untracked-files=normal')
    expect(runner).toContain('worktree must be clean')
  })

  it('refuses a passing manifest when any evidence sanitizer fails', () => {
    const runner = readFileSync(join(scripts, 'run-release-candidate.sh'), 'utf8')
    expect(runner).toContain('Evidence sanitization failed; refusing to write a passing manifest')
    expect(runner).not.toContain('sanitize_logs || true')
  })

  it('allows the authorization directory and generated project, but rejects any other workspace entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'oo-live-workspace-'))
    const guard = join(scripts, 'assert-workspace-boundary.sh')
    mkdirSync(join(root, '.co'))

    expect(() => execFileSync('bash', [guard, root, '.co'])).not.toThrow()
    mkdirSync(join(root, 'rust-release-agent'))
    expect(() => execFileSync('bash', [guard, root, '.co', 'rust-release-agent'])).not.toThrow()

    writeFileSync(join(root, 'outside.txt'), 'must fail')
    expect(() => execFileSync('bash', [guard, root, '.co', 'rust-release-agent'], { stdio: 'ignore' })).toThrow()
  })

  it('removes configured secrets, private paths, headers, ANSI and agent addresses', () => {
    const root = mkdtempSync(join(tmpdir(), 'oo-live-sanitize-'))
    const raw = join(root, 'raw.log')
    const clean = join(root, 'clean.log')
    const secrets = join(root, 'secrets.txt')
    const invite = join(root, 'invite.txt')
    const workspace = '/private/tmp/release-candidate/workspace'
    const browserHome = '/private/tmp/release-candidate/browser-home'
    const secret = 'invite-value-DO-NOT-LEAK'
    const inviteSecret = 'one-run-invite-DO-NOT-LEAK'
    writeFileSync(secrets, `${secret}\n`)
    writeFileSync(invite, `${inviteSecret}\n`)
    chmodSync(secrets, 0o600)
    chmodSync(invite, 0o600)
    writeFileSync(raw, [
      '\u001b[31mstarting\u001b[0m',
      `workspace=${workspace}`,
      `browser_home=${browserHome}`,
      `invite_code=${secret}`,
      `invite_code=${inviteSecret}`,
      'Authorization: Bearer abc.def.ghi',
      'Cookie: session=private-cookie',
      'balance: $802.71',
      'file=/Users/person/project/private.py',
      'agent_address=0x18dafe56b0f393...',
    ].join('\n'))

    execFileSync('node', [join(scripts, 'sanitize-evidence.mjs'), raw, clean], {
      env: {
        ...process.env,
        LIVE_E2E_WORKSPACE: workspace,
        LIVE_E2E_BROWSER_HOME: browserHome,
        LIVE_E2E_SECRET_VALUES_FILE: secrets,
        LIVE_E2E_INVITE_CODE_FILE: invite,
        HOME: '/Users/person',
      },
    })
    const value = readFileSync(clean, 'utf8')
    expect(value).toContain('[WORKSPACE]')
    expect(value).toContain('Authorization: [REDACTED]')
    expect(value).toContain('[AGENT_ADDRESS]')
    expect(value).not.toContain(secret)
    expect(value).not.toContain(inviteSecret)
    expect(value).not.toContain(workspace)
    expect(value).not.toContain(browserHome)
    expect(value).not.toContain('/Users/person')
    expect(value).not.toContain('\u001b')
    expect(value).not.toContain('private-cookie')
    expect(value).not.toContain('$802.71')
  })

  it('writes a deterministic inventory with SHA-256 evidence hashes', () => {
    const evidence = mkdtempSync(join(tmpdir(), 'oo-live-manifest-'))
    const screenshot = join(evidence, 'desktop.png')
    writeFileSync(screenshot, 'image bytes')
    execFileSync('node', [join(scripts, 'write-manifest.mjs'), evidence], {
      env: {
        ...process.env,
        LIVE_E2E_CORE_VERSION: 'co 1.7.0b9',
        LIVE_E2E_REACT_VERSION: '0.4.2-beta.2',
        LIVE_E2E_OCHAT_COMMIT: 'abc123',
      },
    })

    const manifest = JSON.parse(readFileSync(join(evidence, 'manifest.json'), 'utf8'))
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.candidate).toMatchObject({
      coreVersion: 'co 1.7.0b9',
      reactVersion: '0.4.2-beta.2',
      oChatCommit: 'abc123',
    })
    expect(manifest.checks.reconnectWithoutResendPassed).toBe(true)
    expect(manifest.checks.onboardingSettled).toBe(true)
    expect(manifest.files).toEqual([{
      path: 'desktop.png',
      bytes: 11,
      sha256: createHash('sha256').update('image bytes').digest('hex'),
    }])
  })

  it('starts, identifies, and stops only its owned Host process', () => {
    const root = mkdtempSync(join(tmpdir(), 'oo-live-host-control-'))
    const workspace = join(root, 'workspace')
    const privateDir = join(root, 'private')
    const fakeCo = join(root, 'fake-co')
    const inviteFile = join(privateDir, 'invite.txt')
    const argsLog = join(privateDir, 'fake-co.args')
    execFileSync('mkdir', ['-p', workspace, privateDir])
    writeFileSync(inviteFile, 'one-run-invite')
    chmodSync(inviteFile, 0o600)
    writeFileSync(fakeCo, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "$LIVE_E2E_FAKE_ARGS_LOG"
port=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--port" ]]; then port="$2"; shift 2; else shift; fi
done
printf '%s\\n' '0x${'a'.repeat(64)}'
node -e 'require("node:http").createServer((_, response) => response.end("ok")).listen(Number(process.argv[1]), "127.0.0.1")' "$port" &
child=$!
trap 'kill -TERM "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; exit 0' INT TERM
wait "$child"
`)
    chmodSync(fakeCo, 0o700)
    const port = String(20_000 + Math.floor(Math.random() * 10_000))
    const env = {
      ...process.env,
      LIVE_E2E_WORKSPACE: workspace,
      LIVE_E2E_CO_BIN: fakeCo,
      LIVE_E2E_HOST_PORT: port,
      LIVE_E2E_INVITE_CODE_FILE: inviteFile,
      LIVE_E2E_FAKE_ARGS_LOG: argsLog,
      LIVE_E2E_PRIVATE_DIR: privateDir,
      LIVE_E2E_HOST_LOG: join(privateDir, 'host.raw.log'),
      LIVE_E2E_HOST_PID_FILE: join(privateDir, 'host.pid'),
      LIVE_E2E_FRONTEND_LOG: join(privateDir, 'frontend.raw.log'),
      LIVE_E2E_FRONTEND_PID_FILE: join(privateDir, 'frontend.pid'),
    }
    const runner = join(scripts, 'run-release-candidate.sh')

    execFileSync('bash', [runner, 'start-host'], { env, timeout: 10_000 })
    const pidFile = join(privateDir, 'host.pid')
    expect(existsSync(pidFile)).toBe(true)
    const pid = Number(readFileSync(pidFile, 'utf8').trim())
    expect(() => process.kill(pid, 0)).not.toThrow()
    expect(readFileSync(argsLog, 'utf8')).toContain(`--invite-code-file\n${inviteFile}\n`)

    execFileSync('bash', [runner, 'stop-host'], { env, timeout: 10_000 })
    expect(readFileSync(pidFile, 'utf8')).toBe('')
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('requires invocation-scoped invite files to be non-empty and mode 600', () => {
    const runner = readFileSync(join(scripts, 'run-release-candidate.sh'), 'utf8')
    expect(runner).toContain('LIVE_E2E_INVITE_CODE_FILE must name a non-empty invite code file')
    expect(runner).toContain('LIVE_E2E_INVITE_CODE_FILE must have mode 600')
    expect(runner).toContain('--invite-code-file "$invite_code_file"')
    expect(runner).toContain("/usr/bin/stat -f '%Lp'")
    expect(runner).toContain("stat -c '%a'")
  })

  it('fails closed before Host start when the invite file is empty or too broad', () => {
    const root = mkdtempSync(join(tmpdir(), 'oo-live-invalid-invite-'))
    const workspace = join(root, 'workspace')
    const invite = join(root, 'invite.txt')
    const fakeCo = join(root, 'fake-co')
    mkdirSync(workspace)
    writeFileSync(fakeCo, '#!/usr/bin/env bash\nexit 99\n')
    chmodSync(fakeCo, 0o700)
    const runner = join(scripts, 'run-release-candidate.sh')
    const env = {
      ...process.env,
      LIVE_E2E_WORKSPACE: workspace,
      LIVE_E2E_CO_BIN: fakeCo,
      LIVE_E2E_INVITE_CODE_FILE: invite,
    }

    writeFileSync(invite, '')
    chmodSync(invite, 0o600)
    expect(() => execFileSync('bash', [runner, 'start-host'], { env, stdio: 'ignore' })).toThrow()

    writeFileSync(invite, 'private-invite')
    chmodSync(invite, 0o644)
    expect(() => execFileSync('bash', [runner, 'start-host'], { env, stdio: 'ignore' })).toThrow()
  })

  it('pastes onboarding secrets without putting them in browser command arguments', () => {
    const runner = readFileSync(join(scripts, 'run-production-acceptance.sh'), 'utf8')
    const load = runner.indexOf('load_invite_clipboard')
    const paste = runner.indexOf("keyboard_press 'Meta+v'", load)
    const restore = runner.indexOf('restore_clipboard', paste)
    const submit = runner.indexOf("'button[type=\"submit\"]'", restore)

    expect(load).toBeGreaterThan(-1)
    expect(paste).toBeGreaterThan(load)
    expect(restore).toBeGreaterThan(paste)
    expect(submit).toBeGreaterThan(restore)
    expect(runner.slice(load, submit)).not.toContain('type_text_by_selector')
    expect(runner.slice(paste, restore)).not.toContain('take_screenshot')
    expect(runner).toContain('click_button "Reconnect"')
    expect(runner).not.toContain('click_button "reconnect"')
    expect(runner).toContain('local timeout="${2:-20}"')
    expect(runner).toContain('reconnect path=explicit-click')
    expect(runner).toContain('reconnect path=automatic')
    expect(runner).toContain('browser_isolated=true')
    expect(runner).toContain('CO_BROWSER_SOCK=$browser_sock')
    expect(runner).toContain('co browser close')
  })
})
