#!/usr/bin/env bash

set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"

: "${LIVE_E2E_WORKSPACE:?Set LIVE_E2E_WORKSPACE to a dedicated workspace (it may contain only .co)}"

co_bin="${LIVE_E2E_CO_BIN:-$(command -v co)}"
host_port="${LIVE_E2E_HOST_PORT:-8765}"
frontend_port="${LIVE_E2E_FRONTEND_PORT:-3100}"
run_id="${LIVE_E2E_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
private_dir="${LIVE_E2E_PRIVATE_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/oo-live-e2e.XXXXXX")}"
evidence_dir="${LIVE_E2E_EVIDENCE_DIR:-$repo_dir/e2e-release-evidence/$run_id}"
host_log="${LIVE_E2E_HOST_LOG:-$private_dir/host.raw.log}"
frontend_log="${LIVE_E2E_FRONTEND_LOG:-$private_dir/frontend.raw.log}"
browser_log="${LIVE_E2E_BROWSER_LOG:-$private_dir/browser.raw.log}"
host_pid_file="${LIVE_E2E_HOST_PID_FILE:-$private_dir/host.pid}"
frontend_pid_file="${LIVE_E2E_FRONTEND_PID_FILE:-$private_dir/frontend.pid}"
host_control="${LIVE_E2E_HOST_CONTROL:-$script_dir/run-release-candidate.sh}"
invite_code_file="${LIVE_E2E_INVITE_CODE_FILE:-}"

export LIVE_E2E_CO_BIN="$co_bin"
export LIVE_E2E_HOST_PORT="$host_port"
export LIVE_E2E_FRONTEND_PORT="$frontend_port"
export LIVE_E2E_RUN_ID="$run_id"
export LIVE_E2E_PRIVATE_DIR="$private_dir"
export LIVE_E2E_EVIDENCE_DIR="$evidence_dir"
export LIVE_E2E_OUTPUT_DIR="$evidence_dir/screenshots"
export LIVE_E2E_HOST_LOG="$host_log"
export LIVE_E2E_FRONTEND_LOG="$frontend_log"
export LIVE_E2E_BROWSER_LOG="$browser_log"
export LIVE_E2E_HOST_PID_FILE="$host_pid_file"
export LIVE_E2E_FRONTEND_PID_FILE="$frontend_pid_file"
export LIVE_E2E_HOST_CONTROL="$host_control"
export LIVE_E2E_INVITE_CODE_FILE="$invite_code_file"

file_mode() {
  if [[ "$(uname -s)" == Darwin ]]; then
    /usr/bin/stat -f '%Lp' "$1"
  else
    stat -c '%a' "$1"
  fi
}

validate_invite_file() {
  [[ -n "$invite_code_file" ]] || return 0
  if [[ ! -s "$invite_code_file" ]]; then
    echo "LIVE_E2E_INVITE_CODE_FILE must name a non-empty invite code file" >&2
    return 1
  fi
  local invite_mode
  invite_mode="$(file_mode "$invite_code_file")"
  if [[ "$invite_mode" != 600 ]]; then
    echo "LIVE_E2E_INVITE_CODE_FILE must have mode 600" >&2
    return 1
  fi
}

owned_pid() {
  local pid_file="$1"
  local expected="$2"
  [[ -s "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  # Exact PID ownership is safer than a broad pgrep.
  # shellcheck disable=SC2009
  ps -p "$pid" -o command= | grep -Fq "$expected" || {
    echo "Refusing to signal PID $pid because it is not the owned $expected process" >&2
    return 1
  }
  printf '%s\n' "$pid"
}

wait_for_port() {
  local port="$1"
  local timeout="$2"
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if node -e '
      const net = require("node:net")
      const socket = net.createConnection({host: "127.0.0.1", port: Number(process.argv[1])})
      socket.setTimeout(500)
      socket.once("connect", () => { socket.destroy(); process.exit(0) })
      socket.once("timeout", () => { socket.destroy(); process.exit(1) })
      socket.once("error", () => process.exit(1))
    ' "$port"; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for port $port" >&2
  return 1
}

start_host() {
  validate_invite_file
  if owned_pid "$host_pid_file" "$(basename "$co_bin") ai" >/dev/null 2>&1; then
    echo "Owned Host is already running" >&2
    return 0
  fi
  mkdir -p "$private_dir"
  chmod 700 "$private_dir"
  printf '\nHOST_START %s\n' "$(date -u +%FT%TZ)" >> "$host_log"
  local invite_args=()
  if [[ -n "$invite_code_file" ]]; then
    invite_args=(--invite-code-file "$invite_code_file")
  fi
  (
    cd "$LIVE_E2E_WORKSPACE"
    exec "$co_bin" ai --port "$host_port" --full-access --full-access-turns 12 \
      "${invite_args[@]}"
  ) >> "$host_log" 2>&1 &
  printf '%s\n' "$!" > "$host_pid_file"
  wait_for_port "$host_port" 30
  owned_pid "$host_pid_file" "$(basename "$co_bin") ai" >/dev/null
}

stop_owned_process() {
  local pid_file="$1"
  local expected="$2"
  local signal="${3:-INT}"
  local pid
  pid="$(owned_pid "$pid_file" "$expected")" || return 0
  kill "-$signal" "$pid"
  local deadline=$((SECONDS + 20))
  while kill -0 "$pid" 2>/dev/null && (( SECONDS < deadline )); do sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then
    echo "Owned $expected process did not settle after $signal" >&2
    return 1
  fi
  : > "$pid_file"
}

start_frontend() {
  mkdir -p "$private_dir"
  chmod 700 "$private_dir"
  npm run build >> "$frontend_log" 2>&1
  "$repo_dir/node_modules/.bin/next" start -p "$frontend_port" >> "$frontend_log" 2>&1 &
  printf '%s\n' "$!" > "$frontend_pid_file"
  wait_for_port "$frontend_port" 30
  owned_pid "$frontend_pid_file" "next" >/dev/null
}

sanitize_logs() {
  local status=0
  mkdir -p "$evidence_dir/logs"
  if [[ -f "$host_log" ]]; then
    node "$script_dir/sanitize-evidence.mjs" "$host_log" "$evidence_dir/logs/host.log" || status=$?
  fi
  if [[ -f "$frontend_log" ]]; then
    node "$script_dir/sanitize-evidence.mjs" "$frontend_log" "$evidence_dir/logs/frontend.log" || status=$?
  fi
  if [[ -f "$browser_log" ]]; then
    node "$script_dir/sanitize-evidence.mjs" "$browser_log" "$evidence_dir/logs/browser.log" || status=$?
  fi
  return "$status"
}

case "${1:-run}" in
  start-host)
    start_host
    exit 0
    ;;
  stop-host)
    stop_owned_process "$host_pid_file" "$(basename "$co_bin") ai" TERM
    exit 0
    ;;
  *)
    ;;
esac

if [[ ! -x "$co_bin" ]]; then
  echo "LIVE_E2E_CO_BIN must name an executable co candidate" >&2
  exit 1
fi
if [[ -n "$(git -C "$repo_dir" status --porcelain --untracked-files=normal)" ]]; then
  echo "O Chat worktree must be clean so the evidence commit identifies the exact production build" >&2
  exit 1
fi
if [[ ! -d "$LIVE_E2E_WORKSPACE" ]]; then
  echo "LIVE_E2E_WORKSPACE must already exist" >&2
  exit 1
fi
if [[ -e "$LIVE_E2E_WORKSPACE/rust-release-agent" ]]; then
  echo "Remove the previous rust-release-agent before running a new release gate" >&2
  exit 1
fi
validate_invite_file
if [[ -n "${LIVE_E2E_SECRET_VALUES_FILE:-}" ]]; then
  secret_mode="$(file_mode "$LIVE_E2E_SECRET_VALUES_FILE")"
  if [[ "$secret_mode" != 600 ]]; then
    echo "LIVE_E2E_SECRET_VALUES_FILE must have mode 600" >&2
    exit 1
  fi
fi

mkdir -p "$evidence_dir/screenshots"
chmod 700 "$evidence_dir"

finish() {
  local status=$?
  stop_owned_process "$host_pid_file" "$(basename "$co_bin") ai" TERM || true
  stop_owned_process "$frontend_pid_file" "next" TERM || true
  if ! sanitize_logs; then
    echo "Evidence sanitization failed; refusing to write a passing manifest" >&2
    status=1
  fi
  if [[ "$status" == 0 ]]; then
    node "$script_dir/write-manifest.mjs" "$evidence_dir" || status=$?
  fi
  echo "Private raw logs: $private_dir"
  echo "Sanitized evidence: $evidence_dir"
  return "$status"
}
trap finish EXIT

cd "$repo_dir"
start_frontend
start_host

deadline=$((SECONDS + 30))
address=''
while (( SECONDS < deadline )); do
  address="$(grep -Eo '0x[0-9a-fA-F]{64}' "$host_log" | head -1 || true)"
  [[ -n "$address" ]] && break
  sleep 1
done
if [[ -z "$address" ]]; then
  echo "Could not identify the candidate Agent address from the private Host log" >&2
  exit 1
fi

export LIVE_E2E_ADDRESS="$address"
export LIVE_E2E_BASE_URL="http://localhost:$frontend_port"
LIVE_E2E_CORE_VERSION="$("$co_bin" --version | tail -1)"
LIVE_E2E_CORE_EXECUTABLE_SHA256="$(shasum -a 256 "$co_bin" | awk '{print $1}')"
LIVE_E2E_REACT_VERSION="$(node -p 'require("./package.json").dependencies["@connectonion/react"]')"
LIVE_E2E_OCHAT_COMMIT="$(git rev-parse HEAD)"
export LIVE_E2E_CORE_VERSION LIVE_E2E_CORE_EXECUTABLE_SHA256
export LIVE_E2E_REACT_VERSION LIVE_E2E_OCHAT_COMMIT
export LIVE_E2E_PUBLIC_FRONTEND_URL="local-production-build:http://localhost:$frontend_port"
bash "$script_dir/run-production-acceptance.sh"

echo "Release candidate acceptance passed"
echo "Manifest: $evidence_dir/manifest.json"
