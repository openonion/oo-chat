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
live_base_url="${LIVE_E2E_BASE_URL:-http://127.0.0.1:3100}"
live_output_dir="${LIVE_E2E_OUTPUT_DIR:-$repo_dir/e2e-screenshots}"
browser_log="${LIVE_E2E_BROWSER_LOG:-$live_output_dir/browser-actions.log}"
browser_report_dir="$LIVE_E2E_WORKSPACE/browser-release-report"
c_project_dir="$LIVE_E2E_WORKSPACE/c-release-agent"
project_dir="$LIVE_E2E_WORKSPACE/rust-release-agent"
codex_project_dir="$LIVE_E2E_WORKSPACE/codex-c-release-agent"
click_helper="$script_dir/click-button.js"
submit_helper="$script_dir/submit-prompt.js"
run_state_helper="$script_dir/query-run-state.js"
reconnect_state_helper="$script_dir/query-reconnect-state.js"
workspace_guard="$script_dir/assert-workspace-boundary.sh"
open_provider_helper="$script_dir/open-provider-workroom.js"
provider_state_helper="$script_dir/query-provider-workroom.js"
select_mode_helper="$script_dir/select-mode.js"
invite_input_helper="$script_dir/query-invite-input.js"
tab_opened=false
stop_prompt_marker="LIVE_E2E_STOP_MARKER_17"
invite_code_file="${LIVE_E2E_INVITE_CODE_FILE:-}"
browser_co_bin="${LIVE_E2E_BROWSER_CO_BIN:-${LIVE_E2E_CO_BIN:-$(command -v co)}}"
browser_profile_dir="${LIVE_E2E_BROWSER_PROFILE_DIR:-}"
browser_sock="${LIVE_E2E_BROWSER_SOCK:-}"
browser_isolated=false
browser_headless=false
if [[ -n "$browser_profile_dir" ]]; then
  browser_isolated=true
  browser_headless="${LIVE_E2E_BROWSER_HEADLESS:-true}"
  mkdir -p "$browser_profile_dir"
  chmod 700 "$browser_profile_dir"
  if [[ -z "$browser_sock" ]]; then
    echo "LIVE_E2E_BROWSER_SOCK is required with LIVE_E2E_BROWSER_PROFILE_DIR" >&2
    exit 1
  fi
fi

# Keep the existing command sites readable while routing only this script's
# browser calls through an optional isolated profile/socket while retaining the
# real HOME that macOS Chrome and OS-backed credentials require.
co() {
  local browser_env=("CO_WHO=${CO_WHO:-$live_who}")
  local command_args=("$@")
  if [[ "$browser_isolated" == true ]]; then
    browser_env+=("CO_BROWSER_PROFILE_DIR=$browser_profile_dir" "CO_BROWSER_SOCK=$browser_sock")
  fi
  if [[ "${1:-}" != browser ]]; then
    env "${browser_env[@]}" "$browser_co_bin" "${command_args[@]}"
    return
  fi
  if [[ "$browser_headless" == true && "${2:-}" != --headless ]]; then
    command_args=(browser --headless "${@:2}")
  fi

  # A backgrounded command in a non-interactive shell can inherit /dev/null
  # instead of the caller's pipeline. Keep the one stdin-bearing browser action
  # in the foreground so its secret reaches the CLI; it has no secret argv and
  # runs only after the daemon has answered the invite-field preflight.
  local last_arg_index=$((${#command_args[@]} - 1))
  if [[ "${command_args[$last_arg_index]}" == --stdin ]]; then
    env "${browser_env[@]}" "$browser_co_bin" "${command_args[@]}"
    return
  fi

  # A browser client can block while its page or daemon is unhealthy. Run each
  # client in its own process group-like subshell so one stuck RPC cannot make
  # the surrounding lifecycle deadline or EXIT cleanup unbounded.
  (
    env "${browser_env[@]}" "$browser_co_bin" "${command_args[@]}" &
    local command_pid=$!
    trap 'kill -TERM "$command_pid" 2>/dev/null || true' TERM INT
    local deadline=$((SECONDS + ${LIVE_E2E_BROWSER_COMMAND_TIMEOUT:-20}))
    while kill -0 "$command_pid" 2>/dev/null && (( SECONDS < deadline )); do
      sleep 1
    done
    if kill -0 "$command_pid" 2>/dev/null; then
      kill -TERM "$command_pid" 2>/dev/null || true
      sleep 1
      kill -KILL "$command_pid" 2>/dev/null || true
      wait "$command_pid" 2>/dev/null || true
      local action="${2:-unknown}"
      if [[ "$action" == -t ]]; then action="${4:-unknown}"; fi
      echo "Timed out waiting for co browser command: $action" >&2
      exit 124
    fi
    wait "$command_pid"
  )
}

bounded_browser_cleanup() {
  local action="$1"
  shift
  (CO_WHO="$live_who" co browser "$@" >/dev/null 2>&1) &
  local cleanup_pid=$!
  local deadline=$((SECONDS + 10))
  while kill -0 "$cleanup_pid" 2>/dev/null && (( SECONDS < deadline )); do
    sleep 1
  done
  if kill -0 "$cleanup_pid" 2>/dev/null; then
    kill -TERM "$cleanup_pid" 2>/dev/null || true
    wait "$cleanup_pid" 2>/dev/null || true
    record "cleanup action=$action timeout=true"
    return 1
  fi
  wait "$cleanup_pid" 2>/dev/null || true
  record "cleanup action=$action timeout=false"
}

stop_isolated_browser_daemon() {
  [[ "$browser_isolated" == true ]] || return 0
  local pid_file="${browser_sock}.pid"
  [[ -s "$pid_file" ]] || return 0
  local daemon_pid
  daemon_pid="$(cat "$pid_file")"
  [[ "$daemon_pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$daemon_pid" 2>/dev/null || return 0
  local command
  command="$(ps -p "$daemon_pid" -o command=)"
  if [[ "$command" != *"connectonion.cli.browser_agent.daemon $browser_sock"* ]]; then
    echo "Refusing to stop unexpected isolated browser PID $daemon_pid" >&2
    return 1
  fi
  kill -TERM "$daemon_pid"
  local deadline=$((SECONDS + 10))
  while kill -0 "$daemon_pid" 2>/dev/null && (( SECONDS < deadline )); do sleep 1; done
  if kill -0 "$daemon_pid" 2>/dev/null; then
    kill -KILL "$daemon_pid" 2>/dev/null || true
    wait "$daemon_pid" 2>/dev/null || true
    record "cleanup action=isolated-daemon forced=true"
  fi
}

stop_isolated_chrome() {
  [[ "$browser_isolated" == true ]] || return 0
  local profile="$browser_profile_dir"
  local pids
  pids="$(pgrep -f -- "--user-data-dir=$profile" || true)"
  [[ -n "$pids" ]] || return 0
  local pid command
  for pid in $pids; do
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    [[ -n "$command" ]] || continue
    if [[ "$command" != *"--user-data-dir=$profile"* ]]; then
      echo "Refusing to stop unexpected Chrome PID $pid" >&2
      return 1
    fi
    kill -TERM "$pid" 2>/dev/null || true
  done
  local deadline=$((SECONDS + 10))
  while (( SECONDS < deadline )); do
    pids="$(pgrep -f -- "--user-data-dir=$profile" || true)"
    [[ -z "$pids" ]] && return 0
    sleep 1
  done
  for pid in $pids; do
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    [[ -n "$command" ]] || continue
    if [[ "$command" == *"--user-data-dir=$profile"* ]]; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  record "cleanup action=isolated-chrome forced=true"
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

click_button_once() {
  local text="$1"
  local result
  result="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$click_helper" "{\"text\":\"$text\"}")"
  if printf '%s' "$result" | grep -Eq '"ok":[[:space:]]*true'; then
    record "click action=$text ok=true"
    return 0
  fi
  return 1
}

select_mode() {
  local expected="$1"
  local state
  state="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$select_mode_helper" "{\"expected\":\"$expected\",\"open\":true}")"
  require_browser_ok "open mode menu" "$state"
  if ! printf '%s' "$state" | grep -Eq '"already":[[:space:]]*true'; then
    click_button "$expected"
    if [[ "$expected" == 'Full access' ]]; then
      click_button "Enable"
    fi
  fi

  local deadline=$((SECONDS + 30))
  while (( SECONDS < deadline )); do
    state="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
      "$select_mode_helper" "{\"expected\":\"$expected\",\"open\":false}")"
    if printf '%s' "$state" | grep -Eq '"already":[[:space:]]*true'; then
      record "mode selected=$expected state=$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for mode $expected; last state: $state" >&2
  return 1
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
    "$live_output_dir/live-production-connection-gate.png" >/dev/null || return 1
  local invite_length input_state
  invite_length="$(tr -d '\r\n' < "$invite_code_file" | wc -c | tr -d ' ')"
  input_state="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$invite_input_helper" '{"expectedLength":0,"allowEmpty":true}')" || return 1
  require_browser_ok "find empty invite input" "$input_state" || return 1
  tr -d '\r\n' < "$invite_code_file" | CO_WHO="$live_who" co browser -t "$live_tab" \
    fill_text_by_selector '#onboard-invite-code' --stdin >/dev/null || return 1
  input_state="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$invite_input_helper" "{\"expectedLength\":$invite_length}")" || return 1
  require_browser_ok "fill invite input" "$input_state" || return 1
  record "invite-input characters=$invite_length ok=true"
  CO_WHO="$live_who" co browser -t "$live_tab" click_element_by_selector \
    'button[type="submit"]' >/dev/null || return 1
  record "click action=invite-submit ok=true"
  wait_for_run_state composerPresent 45 || return 1
  record "onboard invite-file=true settled=true"
}

submit_prompt() {
  local prompt="$1"
  local result args_json
  args_json="$(node -e \
    'process.stdout.write(JSON.stringify({ prompt: process.argv[1] }))' "$prompt")"
  result="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$submit_helper" "$args_json")"
  require_browser_ok "fill prompt" "$result"
  record "fill characters=$(printf '%s' "$result" | sed -n 's/.*"characters":[[:space:]]*\([0-9][0-9]*\).*/\1/p') ok=true"
}

navigate_client() {
  local url="$1"
  local result=''
  local attempt
  for attempt in 1 2; do
    if result="$(CO_WHO="$live_who" LIVE_E2E_BROWSER_COMMAND_TIMEOUT=40 \
      co browser -t "$live_tab" go_to "$url")"; then
      [[ "$result" == Navigated\ to\ "$url"* ]] || {
        echo "Browser did not settle on the release client: $result" >&2
        return 1
      }
      record "navigate client=true recovered=false attempt=$attempt"
      return 0
    fi

    # Chromium can receive the complete localhost response while a third-party
    # resource keeps DOMContentLoaded from settling. Core #1193 keeps the daemon
    # responsive after that Page.goto timeout, so stop the load and verify the
    # authoritative current URL before any DOM assertion. Never treat a timeout
    # alone as success.
    CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Escape >/dev/null
    result="$(CO_WHO="$live_who" co browser -t "$live_tab" get_current_url)"
    if [[ "$result" == "$url" ]]; then
      record "navigate client=true recovered=true attempt=$attempt"
      return 0
    fi
    if [[ "$result" != about:blank ]]; then
      echo "Browser navigation recovery settled on the wrong URL: $result" >&2
      return 1
    fi
    if [[ "$attempt" -eq 1 ]]; then
      record "navigate client=false cold-start-retry=true attempt=$attempt"
      sleep 1
    fi
  done
  echo "Browser navigation remained about:blank after 2 attempts" >&2
  return 1
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

open_provider_workroom() {
  local provider="$1"
  local result
  result="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
    "$open_provider_helper" "{\"provider\":\"$provider\"}")"
  require_browser_ok "open $provider Workroom" "$result"
  record "provider-workroom open provider=$provider state=$result"
}

wait_for_provider_workroom() {
  local provider="$1"
  local timeout="$2"
  local deadline=$((SECONDS + timeout))
  local state=''
  while (( SECONDS < deadline )); do
    state="$(CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
      "$provider_state_helper" "{\"provider\":\"$provider\"}")"
    if printf '%s' "$state" | grep -Eq '"ok":[[:space:]]*true' && \
      printf '%s' "$state" | grep -Eq '"conversationPresent":[[:space:]]*true' && \
      printf '%s' "$state" | grep -Eq '"composerPresent":[[:space:]]*true' && \
      printf '%s' "$state" | grep -Eq '"composerEnabled":[[:space:]]*true' && \
      printf '%s' "$state" | grep -Eq '"currentStatusPresent":[[:space:]]*true' && \
      printf '%s' "$state" | grep -Eq '"statusHasRawNoise":[[:space:]]*false' && \
      printf '%s' "$state" | grep -Eq '"messageCount":[[:space:]]*[2-9][0-9]*'; then
      record "provider-workroom ready provider=$provider state=$state"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for the $provider Workroom client; last state: $state" >&2
  return 1
}

require_host_tool_since() {
  local byte_offset="$1"
  local pattern="$2"
  local label="$3"
  if ! tail -c "+$((byte_offset + 1))" "$LIVE_E2E_HOST_LOG" | grep -Eq "$pattern"; then
    echo "The $label task did not produce its required native tool evidence" >&2
    return 1
  fi
  record "host-tool label=$label evidence=true"
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
  local attempts=0
  while (( SECONDS < deadline )); do
    state="$(reconnect_state)"
    if printf '%s' "$state" | grep -Eq '"connected":[[:space:]]*true'; then
      local path='automatic'
      if (( attempts > 0 )); then path='explicit-click'; fi
      record "reconnect path=$path attempts=$attempts state=$state"
      return 0
    fi
    if printf '%s' "$state" | grep -Eq '"reconnectVisible":[[:space:]]*true'; then
      if click_button_once "Reconnect"; then
        attempts=$((attempts + 1))
        record "reconnect click=$attempts state=$state"
      fi
      # Host recovery can complete between observing the button and clicking it.
      # Re-read authority instead of turning a successful automatic reconnect
      # into a stale-element failure.
      state="$(reconnect_state)"
      if printf '%s' "$state" | grep -Eq '"connected":[[:space:]]*true'; then
        record "reconnect path=automatic-during-click attempts=$attempts state=$state"
        return 0
      fi
    fi
    sleep 1
  done
  echo "Timed out waiting for explicit or automatic reconnect after $attempts click attempts; last state: $state" >&2
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
  if [[ "$tab_opened" == true ]]; then
    bounded_browser_cleanup tab-close tab close "$live_tab" || true
  fi
  if [[ "$browser_isolated" == true ]]; then
    bounded_browser_cleanup daemon-close close || true
    stop_isolated_browser_daemon || true
    stop_isolated_chrome || true
  fi
}
trap cleanup EXIT

CO_WHO="$live_who" co browser tab open "$live_tab" \
  --who "$live_who" --for "production Beta release acceptance" --needs 30m
tab_opened=true
navigate_client "$live_base_url/$LIVE_E2E_ADDRESS"

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

select_mode "Auto"
select_mode "Full access"

# Browser activity must run through the real co ai tool path and the same
# isolated daemon as the gate. The resulting file is independently checked;
# model prose and a prompt that merely mentions the browser do not count.
browser_host_offset="$(wc -c < "$LIVE_E2E_HOST_LOG" | tr -d ' ')"
submit_prompt "Use the co browser CLI, not curl or another HTTP client, to open a dedicated named tab, run go_to for $live_base_url, and run get_text to read the visible page. Do not take a screenshot. Close only that tab. Then create browser-release-report/report.json containing exactly {\"url\":\"$live_base_url/\",\"visibleBrand\":\"oo-chat\"}. Do not modify anything outside browser-release-report."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_run_state running 30
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-browser-task-running-desktop.png" >/dev/null
wait_for_run_complete 150
test -f "$browser_report_dir/report.json"
node -e '
  const fs = require("node:fs")
  const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
  if (report.url !== process.argv[2] + "/") process.exit(1)
  if (report.visibleBrand !== "oo-chat") process.exit(1)
' "$browser_report_dir/report.json" "$live_base_url"
# Console deliberately truncates long command summaries. Match the exact
# Co-browser verb prefix it preserves (go_t... / get_...) and require the
# independently validated report above, rather than pretending full argv is in
# this human-readable log.
require_host_tool_since "$browser_host_offset" 'bash: co browser -t [^ ]+ go_t\.\.\.' 'browser navigation'
require_host_tool_since "$browser_host_offset" 'bash: co browser -t [^ ]+ get_\.\.\.' 'browser inspection'
"$workspace_guard" "$LIVE_E2E_WORKSPACE" .co browser-release-report

# A strict C build catches a different class of filesystem/compiler failures
# than Cargo. Compile independently from the files on disk after the UI settles.
submit_prompt "Create a C11 insertion-sort project at c-release-agent with sort.h, sort.c, main.c, test_sort.c, Makefile, and README.md. Export void insertion_sort(int *values, size_t count). Compile every target with -std=c11 -Wall -Wextra -Werror. Tests must print exactly c sort tests passed; the program must print exactly 1,2,3,5,8. Run both, fix failures, and do not modify anything outside c-release-agent."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_run_state running 30
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-c-task-running-desktop.png" >/dev/null
wait_for_run_complete 180
test -f "$c_project_dir/sort.h"
test -f "$c_project_dir/sort.c"
test -f "$c_project_dir/main.c"
test -f "$c_project_dir/test_sort.c"
cc -std=c11 -Wall -Wextra -Werror "$c_project_dir/sort.c" \
  "$c_project_dir/test_sort.c" -o "$c_project_dir/release-test-sort"
test "$("$c_project_dir/release-test-sort")" = 'c sort tests passed'
cc -std=c11 -Wall -Wextra -Werror "$c_project_dir/sort.c" \
  "$c_project_dir/main.c" -o "$c_project_dir/release-sort"
test "$("$c_project_dir/release-sort")" = '1,2,3,5,8'
"$workspace_guard" "$LIVE_E2E_WORKSPACE" .co browser-release-report c-release-agent

submit_prompt "Create a Rust CLI project in the current workspace at rust-release-agent. Include Cargo.toml, src/main.rs, a unit test, and README.md. The CLI must print one JSON object with name release-beta-agent and status ready. Run cargo test, fix failures, report the exact result, and do not modify anything outside rust-release-agent."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_run_state running 30
wait_for_run_complete 180

test -f "$project_dir/Cargo.toml"
test -f "$project_dir/src/main.rs"
test -f "$project_dir/README.md"
"$workspace_guard" "$LIVE_E2E_WORKSPACE" .co browser-release-report c-release-agent rust-release-agent

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

# Force an actual native Codex handoff. The filesystem compiler check and the
# provider Workroom DOM check jointly prove delegation; model prose alone cannot.
codex_host_offset="$(wc -c < "$LIVE_E2E_HOST_LOG" | tr -d ' ')"
submit_prompt "Use the native Codex tool to create a non-trivial C11 ring buffer project at codex-c-release-agent. It must contain ring_buffer.h, ring_buffer.c, test_ring_buffer.c, and README.md; cover wraparound, full, empty, and FIFO behavior; compile with -std=c11 -Wall -Wextra -Werror; and print exactly codex ring buffer tests passed. Have Codex run the tests. Do not implement the files yourself and do not modify anything outside codex-c-release-agent."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_run_state running 30
wait_for_run_complete 240
test -f "$codex_project_dir/ring_buffer.h"
test -f "$codex_project_dir/ring_buffer.c"
test -f "$codex_project_dir/test_ring_buffer.c"
cc -std=c11 -Wall -Wextra -Werror "$codex_project_dir/ring_buffer.c" \
  "$codex_project_dir/test_ring_buffer.c" -o "$codex_project_dir/release-ring-buffer-test"
test "$("$codex_project_dir/release-ring-buffer-test")" = 'codex ring buffer tests passed'
require_host_tool_since "$codex_host_offset" '⚡ codex|▸ codex' 'Codex delegation'
"$workspace_guard" "$LIVE_E2E_WORKSPACE" .co browser-release-report c-release-agent rust-release-agent codex-c-release-agent

open_provider_workroom "Codex"
wait_for_provider_workroom "Codex" 45
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 1440 900 >/dev/null
assert_layout 1440
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-codex-workroom-desktop.png" >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 768 1024 >/dev/null
assert_layout 768
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-codex-workroom-tablet.png" >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 390 844 >/dev/null
assert_layout 390
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-codex-workroom-mobile.png" >/dev/null
click_button "Back"

click_button "Exit Full access"
select_mode "Read only"
submit_prompt "Reply exactly READ_ONLY_OK. Do not use tools."
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
wait_for_marker_count READ_ONLY_OK 2 60

select_mode "Auto"
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
