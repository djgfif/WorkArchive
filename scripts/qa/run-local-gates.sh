#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use --silent
else
  echo "nvm was not found. Install Node from $ROOT_DIR/.nvmrc or run under a matching runtime." >&2
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

npm run lint
npm run check:docs-links
npm run security:public
npm run qa:commercial:repo
npm run typecheck
npm run test
