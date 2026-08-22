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

  it('uses non-blocking client navigation and bounded owned-browser cleanup', () => {
    const runner = readFileSync(join(scripts, 'run-production-acceptance.sh'), 'utf8')
    expect(runner).toContain('navigate_client "$live_base_url/$LIVE_E2E_ADDRESS"')
    expect(runner).toContain('bounded_browser_cleanup tab-close')
    expect(runner).toContain('stop_isolated_browser_daemon')
    expect(runner).toContain('stop_isolated_chrome')
    expect(runner).toContain('cleanup action=isolated-daemon forced=true')
    expect(runner).toContain('LIVE_E2E_BROWSER_COMMAND_TIMEOUT=40')
    expect(runner).toContain('co browser -t "$live_tab" go_to "$url"')
    expect(runner).toContain('Browser did not settle on the release client')
    expect(runner).toContain('http://127.0.0.1:3100')
    expect(runner).toContain('co browser -t "$live_tab" keyboard_press Escape')
    expect(runner).toContain('co browser -t "$live_tab" get_current_url')
    expect(runner).toContain('for attempt in 1 2')
    expect(runner).toContain('result" != about:blank')
    expect(runner).toContain('cold-start-retry=true attempt=$attempt')
    expect(runner).toContain('Browser navigation remained about:blank after 2 attempts')
    expect(runner).toContain('navigate client=true recovered=true attempt=$attempt')
    expect(runner).toContain('reconnect path=automatic-during-click')
    expect(runner).toContain('click_button_once "Reconnect"')
    expect(readFileSync(join(scripts, 'click-button.js'), 'utf8'))
      .toContain('toLocaleLowerCase()')
    expect(runner).toContain('reconnect click=$attempts')
    expect(runner).toContain('after $attempts click attempts')
    expect(runner).not.toContain('wait_for_reconnect_state live 45')
    expect(runner).toContain('LIVE_E2E_BROWSER_CO_BIN:-${LIVE_E2E_CO_BIN')
    expect(runner).toContain('LIVE_E2E_BROWSER_HEADLESS:-true')
    expect(runner).toContain('CO_BROWSER_PROFILE_DIR=$browser_profile_dir')
    expect(runner).not.toContain('HOME=$browser_home')
    expect(runner).toContain('command_args=(browser --headless')
    expect(readFileSync(join(scripts, 'run-release-candidate.sh'), 'utf8'))
      .toContain('LIVE_E2E_BASE_URL:-http://127.0.0.1:$frontend_port')
    expect(readFileSync(join(scripts, 'run-release-candidate.sh'), 'utf8'))
      .toContain('LIVE_E2E_PUBLIC_FRONTEND_URL:-local-production-build:')
    expect(readFileSync(join(scripts, 'run-release-candidate.sh'), 'utf8'))
      .toContain('LIVE_E2E_BROWSER_SHARED:-false')
    expect(runner).toContain('LIVE_E2E_BROWSER_COMMAND_TIMEOUT:-20')
    expect(runner).toContain('Timed out waiting for co browser command')
    expect(runner).toContain("'bash: co browser -t [^ ]+ go_t(o|\\.\\.\\.)' 'browser navigation'")
    expect(runner).toContain("'bash: co browser -t [^ ]+ get_(text|\\.\\.\\.)' 'browser inspection'")
    expect(runner).toContain('open_provider_workroom "Codex"')
    expect(runner).toContain('wait_for_provider_workroom "Codex" 45')
    expect(readFileSync(join(scripts, 'open-provider-workroom.js'), 'utf8'))
      .toContain('Open Work Room')
    expect(readFileSync(join(scripts, 'open-provider-workroom.js'), 'utf8'))
      .toContain("section[aria-label]")
    expect(readFileSync(join(scripts, 'query-provider-workroom.js'), 'utf8'))
      .toContain('conversationPresent')
    expect(runner).toContain('select_mode "Auto"')
    expect(runner).toContain('select_mode "Full access"')
    expect(runner).toContain('select_mode "Read only"')
    expect(runner).toContain('JSON.stringify({ prompt: process.argv[1] })')
    expect(readFileSync(join(scripts, 'select-mode.js'), 'utf8'))
      .toContain("startsWith('Mode: ')")
    expect(runner).toContain("fill_text_by_selector '#onboard-invite-code' --stdin")
    expect(runner).not.toContain("'#onboard-invite-code' \"$invite_value\"")
    expect(runner).toContain('wait_for_run_state composerPresent 45 || return 1')
    expect(readFileSync(join(scripts, 'query-invite-input.js'), 'utf8'))
      .toContain('input.value.length === expectedLength')
    expect(runner).toContain('{"expectedLength":0,"allowEmpty":true}')
    expect(runner).toContain('cpp-release-agent')
    expect(runner).toContain('c++ -std=c++20 -Wall -Wextra -Werror -pedantic')
    expect(runner).toContain("= 'cpp lru tests passed'")
    expect(runner).toContain("= '4,2,5'")
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

  it('allows every gated generated project, but rejects any other workspace entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'oo-live-workspace-'))
    const guard = join(scripts, 'assert-workspace-boundary.sh')
    mkdirSync(join(root, '.co'))

    expect(() => execFileSync('bash', [guard, root, '.co'])).not.toThrow()
    for (const name of ['browser-release-report', 'c-release-agent', 'cpp-release-agent', 'rust-release-agent', 'codex-c-release-agent']) {
      mkdirSync(join(root, name))
    }
    const allowed = ['.co', 'browser-release-report', 'c-release-agent', 'cpp-release-agent', 'rust-release-agent', 'codex-c-release-agent']
    expect(() => execFileSync('bash', [guard, root, ...allowed])).not.toThrow()

    writeFileSync(join(root, 'outside.txt'), 'must fail')
    expect(() => execFileSync('bash', [guard, root, ...allowed], { stdio: 'ignore' })).toThrow()
  })

  it('removes configured secrets, private paths, headers, ANSI and agent addresses', () => {
    const root = mkdtempSync(join(tmpdir(), 'oo-live-sanitize-'))
    const raw = join(root, 'raw.log')
    const clean = join(root, 'clean.log')
    const secrets = join(root, 'secrets.txt')
    const invite = join(root, 'invite.txt')
    const workspace = '/private/tmp/release-candidate/workspace'
    const browserProfile = '/private/tmp/release-candidate/browser-profile'
    const secret = 'invite-value-DO-NOT-LEAK'
    const inviteSecret = 'one-run-invite-DO-NOT-LEAK'
    writeFileSync(secrets, `${secret}\n`)
    writeFileSync(invite, `${inviteSecret}\n`)
    chmodSync(secrets, 0o600)
    chmodSync(invite, 0o600)
    writeFileSync(raw, [
      '\u001b[31mstarting\u001b[0m',
      `workspace=${workspace}`,
      `browser_profile=${browserProfile}`,
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
        LIVE_E2E_BROWSER_PROFILE_DIR: browserProfile,
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
    expect(value).not.toContain(browserProfile)
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
    expect(manifest.checks.browserTaskPassed).toBe(true)
    expect(manifest.checks.cStrictCompilePassed).toBe(true)
    expect(manifest.checks.cppStrictCompilePassed).toBe(true)
    expect(manifest.checks.nativeCodexDelegationPassed).toBe(true)
    expect(manifest.checks.codexWorkroomConversationPassed).toBe(true)
    expect(manifest.checks.uiReviewPassed).toBe(false)
    expect(manifest.files).toEqual([{
      path: 'desktop.png',
      bytes: 11,
      sha256: createHash('sha256').update('image bytes').digest('hex'),
    }])
  })

  it('requires a complete screenshot-by-screenshot UI review before release', () => {
    const evidence = mkdtempSync(join(tmpdir(), 'oo-live-ui-review-'))
    const screenshot = join(evidence, 'desktop.png')
    const review = join(tmpdir(), `oo-live-ui-review-${process.pid}-${Date.now()}.json`)
    writeFileSync(screenshot, 'image bytes')
    execFileSync('node', [join(scripts, 'write-manifest.mjs'), evidence])
    writeFileSync(review, JSON.stringify({
      schemaVersion: 1,
      reviewer: 'UI designer',
      reviewedAt: new Date().toISOString(),
      screenshotsReviewed: ['desktop.png'],
      checks: Object.fromEntries([
        'newUserExperience',
        'clientFamiliarity',
        'composerAndConversation',
        'thinkingAndWorking',
        'toolActivity',
        'responsiveLayout',
      ].map(name => [name, {
        status: 'pass',
        notes: `${name} was inspected against the release screenshot and is clear.`,
      }])),
      issues: [],
    }))

    expect(() => execFileSync('node', [
      join(scripts, 'review-release-evidence.mjs'), evidence, review,
    ])).not.toThrow()
    const manifest = JSON.parse(readFileSync(join(evidence, 'manifest.json'), 'utf8'))
    expect(manifest.checks.uiReviewPassed).toBe(true)
    expect(manifest.uiReview.reviewer).toBe('UI designer')
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
      'desktop.png',
      'ui-review.json',
    ])
  })

  it('rejects unresolved critical or high UI findings', () => {
    const evidence = mkdtempSync(join(tmpdir(), 'oo-live-ui-blocker-'))
    const review = join(tmpdir(), `oo-live-ui-blocker-${process.pid}-${Date.now()}.json`)
    writeFileSync(join(evidence, 'mobile.png'), 'image bytes')
    execFileSync('node', [join(scripts, 'write-manifest.mjs'), evidence])
    const checks = Object.fromEntries([
      'newUserExperience',
      'clientFamiliarity',
      'composerAndConversation',
      'thinkingAndWorking',
      'toolActivity',
      'responsiveLayout',
    ].map(name => [name, {
      status: 'pass',
      notes: `${name} was inspected against the release screenshot and is clear.`,
    }]))
    writeFileSync(review, JSON.stringify({
      schemaVersion: 1,
      reviewer: 'UI designer',
      reviewedAt: new Date().toISOString(),
      screenshotsReviewed: ['mobile.png'],
      checks,
      issues: [{ severity: 'high', status: 'open', summary: 'Composer is clipped' }],
    }))

    expect(() => execFileSync('node', [
      join(scripts, 'review-release-evidence.mjs'), evidence, review,
    ], { stdio: 'ignore' })).toThrow()
    const manifest = JSON.parse(readFileSync(join(evidence, 'manifest.json'), 'utf8'))
    expect(manifest.checks.uiReviewPassed).toBe(false)
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
    expect(runner).toContain('CO_BROWSER_SOCK=$browser_sock')
    expect(runner).toContain('PATH=$(dirname "$co_bin"):$PATH')
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

  it('streams onboarding secrets without putting them in browser command arguments', () => {
    const runner = readFileSync(join(scripts, 'run-production-acceptance.sh'), 'utf8')
    const fill = runner.indexOf("fill_text_by_selector '#onboard-invite-code' --stdin")
    const verify = runner.indexOf('require_browser_ok "fill invite input"', fill)
    const submit = runner.indexOf("'button[type=\"submit\"]'", verify)

    expect(fill).toBeGreaterThan(-1)
    expect(verify).toBeGreaterThan(fill)
    expect(submit).toBeGreaterThan(verify)
    expect(runner).toContain("tr -d '\\r\\n' < \"$invite_code_file\" |")
    expect(runner.slice(fill, submit)).not.toContain('take_screenshot')
    expect(runner).toContain('if [[ "${command_args[$last_arg_index]}" == --stdin ]]')
    expect(runner).toContain('env "${browser_env[@]}" "$browser_co_bin" "${command_args[@]}"')
    expect(runner).toContain('require_browser_ok "find empty invite input" "$input_state" || return 1')
    expect(runner).toContain('require_browser_ok "fill invite input" "$input_state" || return 1')
    expect(runner).not.toContain('keyboard_press \'Meta+v\'')
    expect(runner).toContain('click_button_once "Reconnect"')
    expect(runner).not.toContain('click_button "reconnect"')
    expect(runner).toContain('local timeout="${2:-20}"')
    expect(runner).toContain("local path='automatic'")
    expect(runner).toContain("path='explicit-click'")
    expect(runner).toContain('reconnect path=automatic')
    expect(runner).toContain('browser_isolated=true')
    expect(runner).toContain('CO_BROWSER_SOCK=$browser_sock')
    expect(runner).toContain('bounded_browser_cleanup daemon-close close')
  })
})
