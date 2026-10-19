#!/usr/bin/env bash
set -euo pipefail
HELPER_DST="$HOME/yt-helper.py"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_DST="$SERVICE_DIR/yt-helper.service"
info() { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

command -v python3 >/dev/null || fail "python3 not found"
command -v curl    >/dev/null || fail "curl not found"

if ! command -v ffmpeg >/dev/null; then
    info "Installing ffmpeg…"
    sudo dnf install -y ffmpeg || fail "ffmpeg install failed"
fi
if ! command -v yt-dlp >/dev/null; then
    info "Installing yt-dlp…"
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
fi
ok "Dependencies: $(yt-dlp --version 2>/dev/null | head -1)"

info "Installing helper…"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/yt-helper.py" "$HELPER_DST"
chmod +x "$HELPER_DST"

info "Installing systemd unit…"
mkdir -p "$SERVICE_DIR"
cp "$SCRIPT_DIR/yt-helper.service" "$SERVICE_DST"
systemctl --user daemon-reload
systemctl --user enable --now yt-helper.service

info "Waiting for helper…"
for i in {1..20}; do
    if curl -sf "http://127.0.0.1:8765/jobs" >/dev/null 2>&1; then ok "Helper running"; break; fi
    sleep 0.5
    [ "$i" -eq 20 ] && fail "Helper failed. Check: systemctl --user status yt-helper.service"
done

YTDLP_CFG="$HOME/.config/yt-dlp/config"
if [ ! -f "$YTDLP_CFG" ]; then
    mkdir -p "$(dirname "$YTDLP_CFG")"
    printf '%s\n' '--concurrent-fragments 16' '--buffer-size 1M' '--no-mtime' > "$YTDLP_CFG"
    ok "yt-dlp speed config written"
fi

cat <<EOF

$(printf '\033[1;32m✓ Installation complete\033[0m')

Next:
  1. Violentmonkey → '+' → new script → paste: $SCRIPT_DIR/yt-dlp-youtube.user.js
  2. Ctrl+S
  3. Open a YouTube video → click blue ⬇ Download

Logs  : journalctl --user -u yt-helper -f
Folder: $HOME/Downloads/YouTube

EOF
