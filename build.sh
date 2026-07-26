#!/usr/bin/env bash
# Đóng gói extension thành .zip (upload Chrome Web Store) và .crx (tự phân phối).
#
#   ./build.sh          -> chỉ tạo .zip
#   ./build.sh --crx    -> tạo cả .zip và .crx (cần Google Chrome)
#
# Lần đầu chạy --crx sẽ sinh key.pem. GIỮ FILE NÀY và đừng commit lên git:
# mọi bản .crx sau đó phải ký bằng đúng key đó, nếu không extension ID sẽ đổi
# và người dùng cũ không nhận được bản cập nhật.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

NAME="live-translate"
VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' manifest.json | head -1 | sed 's/.*"\([0-9][^"]*\)"/\1/')"
[ -n "$VERSION" ] || { echo "Không đọc được version trong manifest.json"; exit 1; }

STAGE="$ROOT/dist/$NAME"
rm -rf "$ROOT/dist"
mkdir -p "$STAGE"

# Chỉ copy những file extension thật sự cần
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
  [ -e "$f" ] || { echo "Thiếu file: $f"; exit 1; }
  cp "$f" "$STAGE/"
done
mkdir -p "$STAGE/icons"
cp icons/*.png "$STAGE/icons/"

# Dọn rác macOS lỡ lọt vào
find "$STAGE" -name '.DS_Store' -delete

ZIP="$ROOT/dist/$NAME-v$VERSION.zip"
( cd "$STAGE" && zip -q -r -X "$ZIP" . )
echo "✓ $ZIP"

if [ "${1:-}" = "--crx" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [ -x "$CHROME" ] || { echo "Không tìm thấy Google Chrome tại $CHROME"; exit 1; }

  if [ -f "$ROOT/key.pem" ]; then
    "$CHROME" --pack-extension="$STAGE" --pack-extension-key="$ROOT/key.pem" >/dev/null 2>&1 || true
  else
    "$CHROME" --pack-extension="$STAGE" >/dev/null 2>&1 || true
    [ -f "$ROOT/dist/$NAME.pem" ] && mv "$ROOT/dist/$NAME.pem" "$ROOT/key.pem" \
      && echo "→ Đã sinh key.pem ở gốc project. Backup lại, đừng commit!"
  fi

  if [ -f "$ROOT/dist/$NAME.crx" ]; then
    mv "$ROOT/dist/$NAME.crx" "$ROOT/dist/$NAME-v$VERSION.crx"
    echo "✓ $ROOT/dist/$NAME-v$VERSION.crx"
  else
    echo "✗ Chrome không tạo được .crx"; exit 1
  fi
fi

rm -rf "$STAGE"
