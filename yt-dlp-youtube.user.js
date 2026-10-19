// ==UserScript==
// @name         YouTube yt-dlp Downloader (fast MP4)
// @namespace    local.ytdlp.v5
// @version      5.0.0
// @description  Instant MP4 360/480/720p dropdown powered by a local yt-dlp helper
// @author       Tayyab Ali
// @match        https://www.youtube.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
    const HELPER = 'http://127.0.0.1:8765';
    const BTN_ID = 'ytdlp-float-btn';
    const PANEL_ID = 'ytdlp-panel';
    const HUD_ID = 'ytdlp-hud';
    const WANTED_HEIGHTS = [720, 480, 360];
    let currentUrl = '', hudTimer = null, cached = null;
    let prefetching = false, prefetchUrl = null, prefetchStartedAt = 0;
    const log = (...a) => console.log('[ytdlp]', ...a);
    function el(tag, css, text) {
        const e = document.createElement(tag);
        if (css) e.style.cssText = css;
        if (text != null) e.textContent = text;
        return e;
    }
    function isWatch() { return location.pathname === '/watch' && location.search.includes('v='); }
    function vidUrl() {
        const v = new URL(location.href).searchParams.get('v');
        return v ? `https://www.youtube.com/watch?v=${v}` : null;
    }
    function pickMp4Formats(formats) {
        const out = [];
        WANTED_HEIGHTS.forEach(h => {
            const matches = formats.filter(f => f.ext === 'mp4' && f.height === h && f.vcodec && f.vcodec !== 'none');
            if (!matches.length) return;
            const h264 = matches.find(f => /^avc1/.test(f.vcodec));
            const chosen = h264 || matches[0];
            out.push({ id: chosen.id, height: h, label: `${h}p` });
        });
        return out;
    }
    function prefetch(url) {
        if (!url || (prefetching && prefetchUrl === url) || (cached && cached.url === url)) return;
        prefetching = true; prefetchUrl = url; prefetchStartedAt = Date.now();
        log('prefetching', url);
        GM_xmlhttpRequest({
            method: 'GET', url: `${HELPER}/formats?url=${encodeURIComponent(url)}`, timeout: 90000,
            onload: (r) => {
                prefetching = false;
                if (r.status !== 200) { log('http', r.status); return; }
                let data; try { data = JSON.parse(r.responseText); } catch { return; }
                if (data.error) { log('error', data.error); return; }
                const filtered = pickMp4Formats(data.formats || []);
                cached = { url, title: data.title, formats: filtered };
                log('prefetch done in', Date.now() - prefetchStartedAt, 'ms:', filtered.map(f => f.label).join(','));
            },
            onerror: () => { prefetching = false; log('helper unreachable'); },
            ontimeout: () => { prefetching = false; log('timeout'); }
        });
    }
    function ensureButton() {
        if (!isWatch()) { document.getElementById(BTN_ID)?.remove(); return; }
        if (document.getElementById(BTN_ID)) return;
        const btn = el('button',
            'position:fixed;top:90px;right:24px;z-index:2147483647;background:#065fd4;color:#fff;' +
            'border:none;padding:10px 18px;border-radius:24px;font-size:14px;font-weight:600;' +
            'cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.5);font-family:Roboto,Arial,sans-serif;',
            '⬇ Download');
        btn.id = BTN_ID;
        btn.onmouseenter = () => btn.style.background = '#0b57d0';
        btn.onmouseleave = () => btn.style.background = '#065fd4';
        btn.onclick = openPanel;
        document.body.appendChild(btn);
    }
    function removePanel() { document.getElementById(PANEL_ID)?.remove(); }
    function openPanel() {
        removePanel();
        const url = vidUrl(); if (!url) return;
        const panel = el('div',
            'position:fixed;top:150px;right:24px;z-index:2147483647;background:#212121;color:#eee;' +
            'padding:18px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.7);' +
            'font-family:Roboto,Arial,sans-serif;min-width:260px;font-size:14px;');
        panel.id = PANEL_ID;
        const head = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;');
        head.appendChild(el('div', 'font-weight:600;', 'Download video'));
        const x = el('button', 'background:#444;color:#fff;border:none;width:28px;height:28px;' +
            'border-radius:14px;cursor:pointer;font-size:14px;', '✕');
        x.onclick = removePanel; head.appendChild(x); panel.appendChild(head);
        const body = el('div', 'color:#aaa;', ''); panel.appendChild(body);
        document.body.appendChild(panel);
        if (cached && cached.url === url && cached.formats.length) { renderFormats(body, cached, url); return; }
        body.textContent = 'Fetching formats…';
        if (!prefetching || prefetchUrl !== url) prefetch(url);
        const start = Date.now();
        const check = () => {
            if (cached && cached.url === url && cached.formats.length) renderFormats(body, cached, url);
            else if (cached && cached.url === url && !cached.formats.length) {
                body.textContent = 'No MP4 360/480/720p found'; body.style.color = '#f88';
            } else if (Date.now() - start > 95000) {
                body.textContent = 'Timed out'; body.style.color = '#f88';
            } else if (!document.body.contains(body)) return;
            else setTimeout(check, 200);
        };
        setTimeout(check, 100);
    }
    function renderFormats(container, cache, url) {
        container.textContent = ''; container.style.color = '#eee';
        if (cache.title) container.appendChild(el('div',
            'font-size:12px;color:#888;margin-bottom:8px;max-height:40px;overflow:hidden;', cache.title));
        const sel = el('select',
            'width:100%;padding:8px;background:#3a3a3a;color:#fff;border:1px solid #555;' +
            'border-radius:6px;font-size:13px;');
        cache.formats.forEach(f => {
            const o = document.createElement('option');
            o.value = f.id; o.textContent = `${f.label} · mp4`; sel.appendChild(o);
        });
        container.appendChild(sel);
        const status = el('div', 'margin-top:12px;font-size:12px;color:#aaa;', '');
        container.appendChild(status);
        const go = el('button',
            'margin-top:12px;width:100%;padding:10px;background:#065fd4;color:#fff;' +
            'border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;', 'Download');
        go.onclick = () => {
            go.disabled = true; status.textContent = '⏳ Queuing…';
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${HELPER}/download?url=${encodeURIComponent(url)}&fmt=${encodeURIComponent(sel.value)}`,
                onload: () => {
                    status.textContent = '✅ Queued'; status.style.color = '#8f8';
                    setTimeout(removePanel, 500); ensureHud();
                },
                onerror: () => { status.textContent = '❌ helper unreachable'; status.style.color = '#f88'; go.disabled = false; }
            });
        };
        container.appendChild(go);
    }
    function ensureHud() {
        if (document.getElementById(HUD_ID)) return;
        const hud = el('div',
            'position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#1e1e1e;color:#eee;' +
            'border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.7);font-family:Roboto,Arial,sans-serif;' +
            'font-size:13px;width:340px;max-height:50vh;overflow:hidden;display:flex;flex-direction:column;');
        hud.id = HUD_ID;
        const bar = el('div',
            'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;' +
            'border-bottom:1px solid #333;font-weight:600;');
        bar.appendChild(el('span', '', '📥 Downloads'));
        const btns = el('div', 'display:flex;gap:6px;');
        const clear = el('button',
            'background:#444;color:#fff;border:none;padding:2px 8px;border-radius:4px;' +
            'font-size:11px;cursor:pointer;', 'Clear done');
        clear.onclick = () => GM_xmlhttpRequest({ method: 'POST', url: `${HELPER}/clear` });
        const toggle = el('button',
            'background:#444;color:#fff;border:none;width:22px;height:22px;border-radius:11px;cursor:pointer;', '−');
        btns.appendChild(clear); btns.appendChild(toggle); bar.appendChild(btns); hud.appendChild(bar);
        const body = el('div', 'padding:6px 10px;overflow-y:auto;max-height:40vh;');
        body.id = 'ytdlp-hud-body'; hud.appendChild(body); document.body.appendChild(hud);
        let collapsed = false;
        toggle.onclick = () => {
            collapsed = !collapsed; body.style.display = collapsed ? 'none' : 'block';
            toggle.textContent = collapsed ? '+' : '−';
        };
        if (hudTimer) clearInterval(hudTimer);
        hudTimer = setInterval(refreshHud, 1500); refreshHud();
    }
    function refreshHud() {
        const body = document.getElementById('ytdlp-hud-body');
        if (!body) { if (hudTimer) clearInterval(hudTimer); hudTimer = null; return; }
        GM_xmlhttpRequest({
            method: 'GET', url: `${HELPER}/jobs`,
            onload: (r) => {
                let jobs; try { jobs = JSON.parse(r.responseText); } catch { return; }
                const ids = Object.keys(jobs); body.textContent = '';
                if (ids.length === 0) { body.appendChild(el('div', 'color:#666;padding:8px 0;text-align:center;', 'No downloads yet')); return; }
                ids.sort((a,b) => (jobs[b].started||0) - (jobs[a].started||0));
                ids.forEach(id => {
                    const j = jobs[id];
                    const row = el('div', 'padding:6px 0;border-bottom:1px solid #2a2a2a;');
                    const top = el('div', 'display:flex;justify-content:space-between;gap:8px;');
                    top.appendChild(el('div', 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;',
                        (j.title || 'video ' + id).slice(0, 60)));
                    top.appendChild(el('div', 'font-size:11px;color:#aaa;flex-shrink:0;', j.status));
                    row.appendChild(top);
                    row.appendChild(el('div', 'font-size:11px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
                        (j.last || '').slice(0, 80)));
                    if (j.status === 'running') {
                        const cancel = el('button',
                            'margin-top:4px;background:#c33;color:#fff;border:none;padding:2px 8px;' +
                            'border-radius:4px;font-size:11px;cursor:pointer;', 'Cancel');
                        cancel.onclick = () => GM_xmlhttpRequest({
                            method: 'POST', url: `${HELPER}/cancel?id=${id}`,
                            onload: () => setTimeout(refreshHud, 500)
                        });
                        row.appendChild(cancel);
                    }
                    body.appendChild(row);
                });
            }
        });
    }
    function tick() {
        const u = vidUrl() || '';
        if (u !== currentUrl) {
            currentUrl = u; cached = null; prefetching = false; prefetchUrl = null;
            removePanel(); ensureButton(); if (u) prefetch(u);
        } else if (isWatch()) ensureButton();
        ensureHud();
    }
    setInterval(tick, 800); tick(); log('ready');
})();
