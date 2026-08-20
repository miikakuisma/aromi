#!/usr/bin/env bash
# Renderöi icon.svg / icon-maskable.svg -lähteistä manifestin tarvitsemat PNG:t.
# Käyttää headless Chromea, jottei koneelle tarvitse asentaa erillistä
# SVG-työkalua. Aja tästä kansiosta: ./render.sh
set -euo pipefail
cd "$(dirname "$0")"

CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
[ -x "$CHROME" ] || { echo "Chromea ei löytynyt: $CHROME" >&2; exit 1; }

wrap=$(mktemp -t icon-wrap).html
trap 'rm -f "$wrap"' EXIT

render() { # lähde koko kohde
  cat > "$wrap" <<HTML
<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:$2px;height:$2px;overflow:hidden}
img{display:block;width:$2px;height:$2px}</style>
<img src="$PWD/$1">
HTML
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$2" --screenshot="$3" "$wrap" 2>/dev/null
  echo "  $3  ($2×$2)"
}

render icon.svg          192 icon-192.png
render icon.svg          512 icon-512.png
render icon.svg          180 apple-touch-icon.png
render icon-maskable.svg 512 icon-maskable-512.png
