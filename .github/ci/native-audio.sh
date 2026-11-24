#!/usr/bin/env bash
set -euo pipefail

engine=(.cache/native-input/cascada-engine-*.tgz)
npm ci --no-audit --no-fund
npm install --no-save --no-audit --no-fund "${engine[0]}" playwright@1.61.0
git diff --exit-code -- package.json package-lock.json
install_peer() {
  mkdir -p "$1"
  echo '{"name":"casai-native-gate","version":"1.0.0","private":true}' > "$1/package.json"
  (cd "$1" && npm install --save-exact --no-audit --no-fund "$2" && npm audit signatures --json > signatures.json)
  node -e "require('node:fs').symlinkSync(require('node:path').resolve(process.argv[1], 'node_modules/node-av'), 'node_modules/node-av', 'junction')" "$1"
}

install_peer .cache/native-install node-av@npm:node-av-lgpl@7.1.0
npm run test:native:release
node --import tsx/esm --test tests/fixtures/phase6-ab-evaluation.mjs
npm run test:matrix:native
node -e "require('node:fs').unlinkSync('node_modules/node-av')"
install_peer .cache/native-gpl node-av@7.1.0
npm run test:native:release:gpl
node --import tsx/esm --test tests/fixtures/phase6-ab-evaluation.mjs
npm run test:matrix:native
if [[ -z "${CASAI_REVIEW_CHROMIUM:-}" ]]; then
  npx --no-install playwright install chromium
fi
npm run test:package -- --engine "${engine[0]}"
