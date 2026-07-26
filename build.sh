#!/usr/bin/env bash
# Packages the extension as a .zip (for the Chrome Web Store) and optionally a
# .crx (for self-distribution).
#
#   ./build.sh          -> .zip only
#   ./build.sh --crx    -> both .zip and .crx (requires Google Chrome)
#
# The first --crx run generates key.pem. KEEP THAT FILE and never commit it:
# every later .crx must be signed with the same key, otherwise the extension ID
# changes and existing users stop receiving updates.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

NAME="live-translate"
VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' manifest.json | head -1 | sed 's/.*"\([0-9][^"]*\)"/\1/')"
[ -n "$VERSION" ] || { echo "Could not read the version from manifest.json"; exit 1; }

STAGE="$ROOT/dist/$NAME"
rm -rf "$ROOT/dist"
mkdir -p "$STAGE"

# Copy only the files the extension actually needs
FILES=(
  manifest.json
  background.js
  content.js
  content.css
  offscreen.html
  offscreen.js
  options.html
  options.css
  options.js
  pcm-worklet.js
)
for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "Missing file: $f"; exit 1; }
  cp "$f" "$STAGE/"
done
mkdir -p "$STAGE/icons"
cp icons/*.png "$STAGE/icons/"

# Strip macOS cruft that may have slipped in
find "$STAGE" -name '.DS_Store' -delete

ZIP="$ROOT/dist/$NAME-v$VERSION.zip"
( cd "$STAGE" && zip -q -r -X "$ZIP" . )
echo "✓ $ZIP"

if [ "${1:-}" = "--crx" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME"; exit 1; }

  if [ -f "$ROOT/key.pem" ]; then
    "$CHROME" --pack-extension="$STAGE" --pack-extension-key="$ROOT/key.pem" >/dev/null 2>&1 || true
  else
    "$CHROME" --pack-extension="$STAGE" >/dev/null 2>&1 || true
    [ -f "$ROOT/dist/$NAME.pem" ] && mv "$ROOT/dist/$NAME.pem" "$ROOT/key.pem" \
      && echo "→ Generated key.pem in the project root. Back it up and do not commit it."
  fi

  if [ -f "$ROOT/dist/$NAME.crx" ]; then
    mv "$ROOT/dist/$NAME.crx" "$ROOT/dist/$NAME-v$VERSION.crx"
    echo "✓ $ROOT/dist/$NAME-v$VERSION.crx"
  else
    echo "✗ Chrome failed to produce the .crx"; exit 1
  fi
fi

rm -rf "$STAGE"
