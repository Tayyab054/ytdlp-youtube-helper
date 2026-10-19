#!/usr/bin/env bash
set -euo pipefail
info() { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }

info "Stopping service…"
systemctl --user disable --now yt-helper.service 2>/dev/null || true
info "Removing unit…"
rm -f "$HOME/.config/systemd/user/yt-helper.service"
systemctl --user daemon-reload
info "Removing helper…"
rm -f "$HOME/yt-helper.py"

cat <<EOF

$(printf '\033[1;32m✓ Uninstalled\033[0m')

Kept: ~/Downloads/YouTube/, ~/.config/yt-dlp/config
Delete the Violentmonkey script manually.

EOF
