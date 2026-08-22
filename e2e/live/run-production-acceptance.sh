#!/usr/bin/env bash

set -euo pipefail
umask 077

export http_proxy=''
export https_proxy=''
export HTTP_PROXY=''
export HTTPS_PROXY=''
export all_proxy=''
export ALL_PROXY=''
export no_proxy='*'
export NO_PROXY='*'

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"

: "${LIVE_E2E_ADDRESS:?Set LIVE_E2E_ADDRESS to the exact co ai candidate address}"
: "${LIVE_E2E_WORKSPACE:?Set LIVE_E2E_WORKSPACE to the dedicated empty co ai workspace}"
: "${LIVE_E2E_HOST_CONTROL:?Set LIVE_E2E_HOST_CONTROL to the owned Host control script}"
: "${LIVE_E2E_HOST_LOG:?Set LIVE_E2E_HOST_LOG to the private raw Host log}"

live_tab="${LIVE_E2E_TAB:-release-beta-production}"
live_who="${LIVE_E2E_WHO:-release-beta-e2e}"
live_base_url="${LIVE_E2E_BASE_URL:-http://localhost:3100}"
live_output_dir="${LIVE_E2E_OUTPUT_DIR:-$repo_dir/e2e-screenshots}"
browser_log="${LIVE_E2E_BROWSER_LOG:-$live_output_dir/browser-actions.log}"
project_dir="$LIVE_E2E_WORKSPACE/rust-release-agent"
click_helper="$script_dir/click-button.js"
submit_helper="$script_dir/submit-prompt.js"
run_state_helper="$script_dir/query-run-state.js"
reconnect_state_helper="$script_dir/query-reconnect-state.js"
workspace_guard="$script_dir/assert-workspace-boundary.sh"
tab_opened=false
stop_prompt_marker="LIVE_E2E_STOP_MARKER_17"
invite_code_file="${LIVE_E2E_INVITE_CODE_FILE:-}"
clipboard_backup=''
clipboard_backend=''
clipboard_loaded=false
browser_co_bin="${LIVE_E2E_BROWSER_CO_BIN:-$(command -v co)}"
browser_home="${LIVE_E2E_BROWSER_HOME:-}"
browser_sock="${LIVE_E2E_BROWSER_SOCK:-}"
browser_isolated=false
if [[ -n "$browser_home" ]]; then
  browser_isolated=true
  mkdir -p "$browser_home"
  chmod 700 "$browser_home"
  if [[ -z "$browser_sock" ]]; then
    echo "LIVE_E2E_BROWSER_SOCK is required with LIVE_E2E_BROWSER_HOME" >&2
    exit 1
  fi
fi

# Keep the existing command sites readable while routing only this script's
# browser calls through an optional isolated HOME/socket/profile. The absolute
# CLI path is resolved before HOME changes, so pyenv shims remain deterministic.
co() {
  local browser_env=("CO_WHO=${CO_WHO:-$live_who}")
  if [[ "$browser_isolated" == true ]]; then
    browser_env+=("HOME=$browser_home" "CO_BROWSER_SOCK=$browser_sock")
  fi
  env "${browser_env[@]}" "$browser_co_bin" "$@"
}

record() {
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> "$browser_log"
}

file_mode() {
  if [[ "$(uname -s)" == Darwin ]]; then
    /usr/bin/stat -f '%Lp' "$1"
  else
    stat -c '%a' "$1"
  fi
}

require_browser_ok() {
  local action="$1"
  local result="$2"
  if ! printf '%s' "$result" | grep -Eq '"ok":[[:space:]]*true'; then
    echo "Browser action failed ($action): $result" >&2
    return 1
  fi
}

click_button() {
  local text="$1"
  local timeout="${2:-20}"
  local deadline=$((SECONDS + timeout))
  local result=''
  while (( SECONDS < deadline )); do
    result="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
      "$click_helper" "{\"text\":\"$text\"}")"
    if printf '%s' "$result" | grep -Eq '"ok":[[:space:]]*true'; then
      record "click action=$text ok=true"
      return 0
    fi
    sleep 1
  done
  require_browser_ok "click $text" "$result"
}

select_clipboard_backend() {
  if command -v pbcopy >/dev/null 2>&1 && command -v pbpaste >/dev/null 2>&1; then
    clipboard_backend='pbcopy'
  elif command -v wl-copy >/dev/null 2>&1 && command -v wl-paste >/dev/null 2>&1; then
    clipboard_backend='wayland'
  elif command -v xclip >/dev/null 2>&1; then
    clipboard_backend='xclip'
  else
    echo "Invite onboarding needs pbcopy/pbpaste, wl-copy/wl-paste, or xclip" >&2
    return 1
  fi
}

save_clipboard() {
  select_clipboard_backend
  clipboard_backup="$(mktemp "${LIVE_E2E_PRIVATE_DIR:-${TMPDIR:-/tmp}}/oo-e2e-clipboard.XXXXXX")"
  case "$clipboard_backend" in
    pbcopy) /usr/bin/pbpaste > "$clipboard_backup" || : > "$clipboard_backup" ;;
    wayland) wl-paste > "$clipboard_backup" || : > "$clipboard_backup" ;;
    xclip) xclip -selection clipboard -o > "$clipboard_backup" || : > "$clipboard_backup" ;;
  esac
  chmod 600 "$clipboard_backup"
}

load_invite_clipboard() {
  case "$clipboard_backend" in
    pbcopy) /usr/bin/pbcopy < "$invite_code_file" ;;
    wayland) wl-copy < "$invite_code_file" ;;
    xclip) xclip -selection clipboard -i < "$invite_code_file" ;;
  esac
  clipboard_loaded=true
}

restore_clipboard() {
  [[ -f "$clipboard_backup" ]] || return 0
  case "$clipboard_backend" in
    pbcopy) /usr/bin/pbcopy < "$clipboard_backup" ;;
    wayland) wl-copy < "$clipboard_backup" ;;
    xclip) xclip -selection clipboard -i < "$clipboard_backup" ;;
  esac
  clipboard_loaded=false
  unlink "$clipboard_backup"
}

onboard_with_invite_file() {
  if [[ -z "$invite_code_file" ]]; then
    return 1
  fi
  if [[ ! -s "$invite_code_file" ]]; then
    echo "LIVE_E2E_INVITE_CODE_FILE must name a non-empty mode-600 file" >&2
    return 1
  fi
  local invite_mode
  invite_mode="$(file_mode "$invite_code_file")"
  if [[ "$invite_mode" != 600 ]]; then
    echo "LIVE_E2E_INVITE_CODE_FILE must have mode 600" >&2
    return 1
  fi

  CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
    "$live_output_dir/live-production-connection-gate.png" >/dev/null
  save_clipboard
  load_invite_clipboard
  CO_WHO="$live_who" co browser -t "$live_tab" click_element_by_selector \
    '#onboard-invite-code' >/dev/null
  if [[ "$(uname -s)" == Darwin ]]; then
    CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press 'Meta+v' >/dev/null
  else
    CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press 'Control+v' >/dev/null
  fi
  restore_clipboard
  CO_WHO="$live_who" co browser -t "$live_tab" click_element_by_selector \
    'button[type="submit"]' >/dev/null
  record "click action=invite-submit ok=true"
  wait_for_run_state composerPresent 45
  record "onboard invite-file=true settled=true"
}

submit_prompt() {
  local prompt="$1"
  local result
  result="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$submit_helper" "{\"prompt\":\"$prompt\"}")"
  require_browser_ok "fill prompt" "$result"
  record "fill characters=$(printf '%s' "$result" | sed -n 's/.*"characters":[[:space:]]*\([0-9][0-9]*\).*/\1/p') ok=true"
}

run_state() {
  CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$run_state_helper" '{}'
}

wait_for_run_state() {
  local expected="$1"
  local timeout="$2"
  local deadline=$((SECONDS + timeout))
  local state=''
  while (( SECONDS < deadline )); do
    state="$(run_state)"
    if printf '%s' "$state" | grep -Eq "\"$expected\":[[:space:]]*true"; then
      record "run-state expected=$expected state=$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for run state $expected=true; last state: $state" >&2
  return 1
}

wait_for_run_complete() {
  local timeout="$1"
  local deadline=$((SECONDS + timeout))
  local state=''
  while (( SECONDS < deadline )); do
    state="$(run_state)"
    if printf '%s' "$state" | grep -Eq '"running":[[:space:]]*false' && \
      printf '%s' "$state" | grep -Eq '"sendReady":[[:space:]]*true'; then
      record "run-complete state=$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for the run to complete; last state: $state" >&2
  return 1
}

reconnect_state() {
  marker_state "$stop_prompt_marker"
}

marker_state() {
  local marker="$1"
  CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$reconnect_state_helper" "{\"promptMarker\":\"$marker\"}"
}

wait_for_marker_count() {
  local marker="$1"
  local expected="$2"
  local timeout="$3"
  local deadline=$((SECONDS + timeout))
  local state=''
  while (( SECONDS < deadline )); do
    state="$(marker_state "$marker")"
    if printf '%s' "$state" | grep -Eq "\"promptOccurrences\":[[:space:]]*$expected"; then
      record "marker-count marker=$marker expected=$expected state=$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $expected occurrences of $marker; last state: $state" >&2
  return 1
}

wait_for_reconnect_state() {
  local expected="$1"
  local timeout="$2"
  local deadline=$((SECONDS + timeout))
  local state=''
  while (( SECONDS < deadline )); do
    state="$(reconnect_state)"
    if printf '%s' "$state" | grep -Eq "\"$expected\":[[:space:]]*true"; then
      printf '%s\n' "$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for reconnect state $expected=true; last state: $state" >&2
  return 1
}

settle_reconnect() {
  local timeout="$1"
  local deadline=$((SECONDS + timeout))
  local state=''
  while (( SECONDS < deadline )); do
    state="$(reconnect_state)"
    if printf '%s' "$state" | grep -Eq '"reconnectVisible":[[:space:]]*true'; then
      click_button "Reconnect"
      record "reconnect path=explicit-click state=$state"
      return 0
    fi
    if printf '%s' "$state" | grep -Eq '"live":[[:space:]]*true'; then
      record "reconnect path=automatic state=$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for explicit or automatic reconnect; last state: $state" >&2
  return 1
}

assert_layout() {
  local expected_width="$1"
  local state
  state="$(reconnect_state)"
  if ! printf '%s' "$state" | grep -Eq "\"viewportWidth\":[[:space:]]*$expected_width"; then
    echo "Browser viewport did not settle at $expected_width: $state" >&2
    return 1
  fi
  if ! printf '%s' "$state" | grep -Eq '"horizontalOverflow":[[:space:]]*false'; then
    echo "Page overflows horizontally at $expected_width: $state" >&2
    return 1
  fi
  record "layout width=$expected_width state=$state"
}

if [[ ! -d "$LIVE_E2E_WORKSPACE" ]]; then
  echo "LIVE_E2E_WORKSPACE must already exist" >&2
  exit 1
fi

"$workspace_guard" "$LIVE_E2E_WORKSPACE" .co

mkdir -p "$live_output_dir"
mkdir -p "$(dirname "$browser_log")"
record "acceptance-start frontend=$live_base_url tab=$live_tab"

cleanup() {
  if [[ "$clipboard_loaded" == true || -f "$clipboard_backup" ]]; then
    restore_clipboard || true
  fi
  if [[ "$tab_opened" == true ]]; then
    CO_WHO="$live_who" co browser tab close "$live_tab" >/dev/null 2>&1 || true
  fi
  if [[ "$browser_isolated" == true ]]; then
    CO_WHO="$live_who" co browser close >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

CO_WHO="$live_who" co browser tab open "$live_tab" \
  --who "$live_who" --for "production Beta release acceptance" --needs 15m
tab_opened=true
CO_WHO="$live_who" co browser -t "$live_tab" go_to \
  "$live_base_url/$LIVE_E2E_ADDRESS" "exact production Beta candidate" "$live_who"

if ! wait_for_run_state composerPresent 45; then
  page_text="$(CO_WHO="$live_who" co browser -t "$live_tab" get_text)"
  if printf '%s' "$page_text" | grep -Eqi 'invite|connect with|access code|onboard'; then
    if ! onboard_with_invite_file; then
      CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
        "$live_output_dir/live-production-connection-gate.png" >/dev/null || true
      echo "The persistent browser identity is not trusted by this Host." >&2
      echo "Set LIVE_E2E_INVITE_CODE_FILE to a mode-600 file or authorize this identity first." >&2
      exit 1
    fi
  else
    echo "The connected Agent composer did not become ready. Visible text: $page_text" >&2
    exit 1
  fi
fi

click_button "Auto"
click_button "Full access"
click_button "Enable"

submit_prompt "Create a Rust CLI project in the current workspace at rust-release-agent. Include Cargo.toml, src/main.rs, a unit test, and README.md. The CLI must print one JSON object with name release-beta-agent and status ready. Run cargo test, fix failures, report the exact result, and do not modify anything outside rust-release-agent."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_run_state running 30
wait_for_run_complete 180

test -f "$project_dir/Cargo.toml"
test -f "$project_dir/src/main.rs"
test -f "$project_dir/README.md"
"$workspace_guard" "$LIVE_E2E_WORKSPACE" .co rust-release-agent

cargo test --manifest-path "$project_dir/Cargo.toml"
test "$(cargo run --quiet --manifest-path "$project_dir/Cargo.toml")" = \
  '{"name":"release-beta-agent","status":"ready"}'

CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 1440 900 >/dev/null
assert_layout 1440
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-rust-full-access-desktop.png" >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 390 844 >/dev/null
assert_layout 390
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-rust-full-access-mobile.png" >/dev/null

click_button "Exit Full access"
click_button "Auto"
click_button "Read only"
submit_prompt "Reply exactly READ_ONLY_OK. Do not use tools."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_marker_count READ_ONLY_OK 2 60

click_button "Read only"
click_button "Auto"
submit_prompt "Reply exactly AUTO_OK. Do not use tools."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_marker_count AUTO_OK 2 60

CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-mode-switches-mobile.png" >/dev/null

# Exercise a real cancellation. The marker lets reconnect prove the browser did
# not resubmit this turn; completion is derived from controls, never model prose.
submit_prompt "$stop_prompt_marker Inspect every file in the Rust project and produce at least 100 distinct review recommendations. Do not modify files, do not start background work, and do not return early."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_run_state running 30
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 1440 900 >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-stop-running-desktop.png" >/dev/null
click_button "Stop agent"
wait_for_run_complete 90
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-stop-settled-desktop.png" >/dev/null

before_reconnect="$(reconnect_state)"
before_occurrences="$(printf '%s' "$before_reconnect" | sed -n 's/.*"promptOccurrences":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
if [[ -z "$before_occurrences" || "$before_occurrences" -lt 1 ]]; then
  echo "Stop marker is missing before reconnect: $before_reconnect" >&2
  exit 1
fi
host_log_offset="$(wc -c < "$LIVE_E2E_HOST_LOG" | tr -d ' ')"

"$LIVE_E2E_HOST_CONTROL" stop-host
disconnected_state="$(wait_for_reconnect_state reconnectVisible 45)"
record "disconnected state=$disconnected_state"
if printf '%s' "$disconnected_state" | grep -Eq '"retryVisible":[[:space:]]*true'; then
  echo "Disconnected UI exposed Retry, which can resend the prior turn: $disconnected_state" >&2
  exit 1
fi
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-disconnected-reconnect.png" >/dev/null

"$LIVE_E2E_HOST_CONTROL" start-host
settle_reconnect 45
wait_for_reconnect_state live 45 >/dev/null
after_reconnect="$(reconnect_state)"
record "reconnected state=$after_reconnect"
after_occurrences="$(printf '%s' "$after_reconnect" | sed -n 's/.*"promptOccurrences":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
if [[ "$after_occurrences" != "$before_occurrences" ]]; then
  echo "Reconnect duplicated the prior prompt: before=$before_occurrences after=$after_occurrences" >&2
  exit 1
fi
if tail -c "+$((host_log_offset + 1))" "$LIVE_E2E_HOST_LOG" | grep -Eq 'recv: INPUT|"type"[[:space:]]*:[[:space:]]*"INPUT"'; then
  echo "Reconnect resent an INPUT to Host" >&2
  exit 1
fi
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 390 844 >/dev/null
assert_layout 390
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-reconnected-mobile.png" >/dev/null

echo "Production acceptance passed"
echo "Evidence: $live_output_dir"
