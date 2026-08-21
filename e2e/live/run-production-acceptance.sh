#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"

: "${LIVE_E2E_ADDRESS:?Set LIVE_E2E_ADDRESS to the exact co ai candidate address}"
: "${LIVE_E2E_WORKSPACE:?Set LIVE_E2E_WORKSPACE to the dedicated empty co ai workspace}"

live_tab="${LIVE_E2E_TAB:-release-beta-production}"
live_who="${LIVE_E2E_WHO:-release-beta-e2e}"
live_base_url="${LIVE_E2E_BASE_URL:-http://localhost:3100}"
live_output_dir="${LIVE_E2E_OUTPUT_DIR:-$repo_dir/e2e-screenshots}"
project_dir="$LIVE_E2E_WORKSPACE/rust-release-agent"
click_helper="$script_dir/click-button.js"
submit_helper="$script_dir/submit-prompt.js"
tab_opened=false

if [[ ! -d "$LIVE_E2E_WORKSPACE" ]]; then
  echo "LIVE_E2E_WORKSPACE must already exist" >&2
  exit 1
fi

if find "$LIVE_E2E_WORKSPACE" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  echo "LIVE_E2E_WORKSPACE must be an empty, dedicated directory" >&2
  exit 1
fi

mkdir -p "$live_output_dir"

cleanup() {
  if [[ "$tab_opened" == true ]]; then
    CO_WHO="$live_who" co browser tab close "$live_tab" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

CO_WHO="$live_who" co browser tab open "$live_tab" \
  --who "$live_who" --for "production Beta release acceptance"
tab_opened=true
CO_WHO="$live_who" co browser -t "$live_tab" go_to \
  "$live_base_url/$LIVE_E2E_ADDRESS" "exact production Beta candidate" "$live_who"

page_text="$(CO_WHO="$live_who" co browser -t "$live_tab" get_text)"
if printf '%s' "$page_text" | grep -Eq 'Invite required|Enter invite|Connect with invite'; then
  echo "The persistent browser identity is not trusted by this Host." >&2
  echo "Complete the one-time invite in this named tab, then rerun with a fresh workspace." >&2
  exit 1
fi

CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Auto"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Full access"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Enable"}' >/dev/null

CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$submit_helper" \
  '{"prompt":"Create a Rust CLI project in the current workspace at rust-release-agent. Include Cargo.toml, src/main.rs, a unit test, and README.md. The CLI must print one JSON object with name release-beta-agent and status ready. Run cargo test, fix failures, report the exact result, and do not modify anything outside rust-release-agent."}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" wait_for_text \
  'test result: ok' 180 >/dev/null

test -f "$project_dir/Cargo.toml"
test -f "$project_dir/src/main.rs"
test -f "$project_dir/README.md"
if find "$LIVE_E2E_WORKSPACE" -mindepth 1 -maxdepth 1 \
  ! -name rust-release-agent -print -quit | grep -q .; then
  echo "The agent modified content outside rust-release-agent" >&2
  exit 1
fi

cargo test --manifest-path "$project_dir/Cargo.toml"
test "$(cargo run --quiet --manifest-path "$project_dir/Cargo.toml")" = \
  '{"name":"release-beta-agent","status":"ready"}'

CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 1440 900 >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-rust-full-access-desktop.png" >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" set_viewport 390 844 >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-rust-full-access-mobile.png" >/dev/null

CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Exit Full access"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Auto"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Read only"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$submit_helper" '{"prompt":"Reply exactly READ_ONLY_OK. Do not use tools."}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" wait_for_text READ_ONLY_OK 60 >/dev/null

CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Read only"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$click_helper" '{"text":"Auto"}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" run_page_script \
  "$submit_helper" '{"prompt":"Reply exactly AUTO_OK. Do not use tools."}' >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" keyboard_press Enter >/dev/null
CO_WHO="$live_who" co browser -t "$live_tab" wait_for_text AUTO_OK 60 >/dev/null

CO_WHO="$live_who" co browser -t "$live_tab" take_screenshot \
  "$live_output_dir/live-production-mode-switches-mobile.png" >/dev/null

echo "Production acceptance passed"
echo "Evidence: $live_output_dir"
