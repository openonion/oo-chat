#!/usr/bin/env bash

set -euo pipefail

workspace="${1:?usage: assert-workspace-boundary.sh <workspace> [allowed-name ...]}"
shift

if [[ ! -d "$workspace" ]]; then
  echo "Workspace does not exist: $workspace" >&2
  exit 1
fi

shopt -s dotglob nullglob
for entry in "$workspace"/*; do
  name="${entry##*/}"
  allowed=false
  for accepted in "$@"; do
    if [[ "$name" == "$accepted" ]]; then
      allowed=true
      break
    fi
  done
  if [[ "$allowed" == false ]]; then
    echo "Unexpected workspace entry: $name" >&2
    exit 1
  fi
done
