#!/usr/bin/env bash
# Refresh github-react-repos.txt: every package.json under the owner's GitHub repos that
# mentions "react", as "<owner>/<repo> <path>". matrix.ts reports the ones PLAN.md §0 does
# not list. Needs an authenticated `gh`.
set -euo pipefail

owner="${1:-VitalyVorobyev}"
out="$(dirname "$0")/github-react-repos.txt"

{
  echo "# gh search code --owner $owner '\"react\":' filename:package.json — refreshed by github-react-repos.sh"
  gh search code --owner "$owner" '"react":' filename:package.json --limit 200 \
    --json repository,path -q '.[] | "\(.repository.nameWithOwner) \(.path)"' | sort -u
} >"$out"

echo "wrote $out"
