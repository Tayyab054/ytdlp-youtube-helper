# ytdlp-youtube-helper

IDM-style YouTube download button for Linux. Floating download button on YouTube with an instant MP4 360/480/720p dropdown, powered by a local yt-dlp + ffmpeg backend.

## Why this exists

Pure browser userscripts cannot download YouTube videos reliably:

- YouTube ciphers stream URLs with n-sig, only yt-dlp solves it.
- Browsers cannot merge video + audio, needs native ffmpeg.
- Trusted Types CSP blocks userscripts from injecting HTML on YouTube.

This project takes the hybrid approach, the closest thing to IDM that works:

    YouTube page  --GM_xmlhttpRequest-->  yt-helper.py (127.0.0.1:8765)  --subprocess-->  yt-dlp + ffmpeg

## Features

- Instant dropdown: formats prefetched on page load
- MP4 only, 360p / 480p / 720p, H.264 preferred
- Persistent HUD: active downloads survive navigation
- Cancel running jobs
- Background queue: continues after closing the tab
- Local only: binds 127.0.0.1

## Requirements

- Linux (Fedora 40+ tested)
- Python 3.10+, yt-dlp, ffmpeg
- Firefox/Chrome + Violentmonkey

## Install

    git clone https://github.com/Tayyab054/ytdlp-youtube-helper.git
    cd ytdlp-youtube-helper
    chmod +x install.sh uninstall.sh
    ./install.sh

Then open Violentmonkey, create a new script, paste yt-dlp-youtube.user.js, save.

Reload any YouTube video. A blue Download button appears top-right.

## Helper API

- GET /formats?url=VIDEO: return filtered format list
- POST /download?url=VIDEO&fmt=ID: start a background job
- GET /status?id=JOB: full status + log
- GET /jobs: all jobs (HUD uses this)
- POST /cancel?id=JOB: kill running yt-dlp
- POST /clear: remove finished jobs

## Config

Change download folder: edit DOWNLOAD_DIR in yt-helper.py, then systemctl --user restart yt-helper.service.

Faster downloads, add to ~/.config/yt-dlp/config:

    --concurrent-fragments 16
    --buffer-size 1M
    --no-mtime

Change qualities: edit WANTED_HEIGHTS in the userscript.

## Uninstall

    ./uninstall.sh

## Limitations

- Not for live streams
- Signed URLs expire around 6 h, reload the page if stale
- Linux only (systemd user service)

## Disclaimer

Personal use only. Download only content you have the right to download. Respect YouTube Terms of Service and copyright law.

## License

MIT, see LICENSE
