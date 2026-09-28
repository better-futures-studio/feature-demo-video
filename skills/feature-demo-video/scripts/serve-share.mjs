// Share finished demo videos (and voice-audition audio tracks) to the user's phone over Tailscale. Binds
// only to this machine's Tailscale address (never 0.0.0.0 or the LAN) and serves only index.html plus
// video/audio/image files sitting directly in <dir>, with HTTP Range support (iOS Safari needs it to play
// media). Without an index.html it lists the videos and audio tracks, each with a Download button, and
// only one plays at a time. Prints the MagicDNS URL to send.
// usage: node serve-share.mjs <dir> [port] [title]   (default port 8787)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '');
const port = Number(process.argv[3] ?? 8787);
const title = process.argv[4] ?? 'Feature demo';
const types = { '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html; charset=utf-8' };

if (!process.argv[2] || !fs.existsSync(root)) {
    console.error('usage: node serve-share.mjs <dir> [port] [title]');
    process.exit(64);
}

let host;
let dnsName = '';

// The Tailscale app for Mac doesn't put its CLI on PATH unless you turn that on, so try the app's own copy too.
for (const cli of ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale']) {
    try {
        host = execFileSync(cli, ['ip', '-4'], { encoding: 'utf8' }).trim().split('\n')[0];
        dnsName = (JSON.parse(execFileSync(cli, ['status', '--json'], { encoding: 'utf8' })).Self?.DNSName ?? '').replace(/\.$/, '');
        break;
    } catch {
        /* not this CLI, or Tailscale isn't running; try the next one */
    }
}

if (!host) {
    console.error('Tailscale is not available; not serving (refusing to bind to a public or LAN interface).');
    process.exit(1);
}

const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function listing() {
    const media = fs.readdirSync(root).filter((name) => /\.(mp4|m4a|mp3)$/.test(name)).sort();
    const player = (name) => {
        const tag = name.endsWith('.mp4') ? 'video' : 'audio';

        // A same-site download link: iPhone Safari saves it to Files, from where it can be shared.
        return `<h2>${escape(name)}</h2><${tag} src="${encodeURIComponent(name)}?v=${Date.now()}" controls playsinline preload="metadata"></${tag}><a class="dl" href="${encodeURIComponent(name)}" download="${escape(name)}">Download</a>`;
    };

    // Starting one player pauses the others, so it's quick to switch between takes.
    return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>body{font:16px -apple-system,system-ui;margin:24px;background:#0f1115;color:#e8eaf0}video,audio{width:100%;margin:8px 0 6px}video{border-radius:12px;background:#000}h1{font-size:20px}h2{font-size:16px;color:#aab2c0;margin:24px 0 8px}a.dl{display:block;text-align:center;padding:12px;border-radius:12px;background:#2563eb;color:#fff;font-weight:600;text-decoration:none;margin:0 0 20px}</style>
<h1>${escape(title)}</h1>${media.map(player).join('') || 'Nothing to play yet.'}
<script>document.addEventListener('play', (e) => document.querySelectorAll('video,audio').forEach((m) => m !== e.target && m.pause()), true);</script>`;
}

http.createServer((req, res) => {
    let name;

    try {
        name = path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)) || 'index.html';
    } catch {
        res.writeHead(400).end();

        return;
    }

    const file = path.join(root, name);
    const type = types[path.extname(name)];
    console.log(new Date().toISOString(), req.method, name, req.headers.range ?? '');

    if (name === 'index.html' && !fs.existsSync(file)) {
        res.writeHead(200, { 'Content-Type': types['.html'] }).end(listing());

        return;
    }

    if (!type || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end('not found');

        return;
    }

    const size = fs.statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');

    if (range) {
        const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
        const end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), size - 1) : size - 1;

        if ((range[1] === '' && range[2] === '') || start > end || start >= size) {
            res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();

            return;
        }

        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);

        return;
    }

    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
}).listen(port, host, () => {
    console.log(`serving ${root} on http://${host}:${port} (Tailscale only)`);

    if (dnsName) {
        console.log(`send this: http://${dnsName}:${port}/`);
    }
});
