// Helpers for recording a feature demo with agent-browser: drive it like a person (eased mouse paths,
// paced typing, smooth scrolling, swipes), time each beat to its voice line, and log a timeline that
// compose.sh turns into the finished video. Every agent-browser call has a timeout so nothing can
// wedge a take. Feature-specific selectors belong in the driver, not here.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = path.resolve(SCRIPTS_DIR, '..');
export const DEMO_DIR = path.resolve(process.env.DEMO_DIR ?? '/tmp/feature-demo');
export const SESSION = process.env.DEMO_SESSION ?? 'feature-demo';

export function ab(...args) {
    const result = spawnSync('agent-browser', ['--session', SESSION, ...args], {
        encoding: 'utf8',
        timeout: Number(process.env.AB_TIMEOUT_MS ?? 20000),
    });

    if (result.error || result.status !== 0) {
        throw new Error(`agent-browser ${args.join(' ')} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
    }

    return result.stdout.trim();
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Deterministic pseudo-random numbers, so a take can be reproduced exactly (DEMO_SEED). */
export function rng(seed = 7) {
    let state = seed >>> 0;

    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;

        return state / 2 ** 32;
    };
}

const random = rng(Number(process.env.DEMO_SEED ?? 7));
const between = (min, max) => min + (max - min) * random();

export function evalJs(js) {
    return JSON.parse(ab('eval', js, '--json')).data?.result;
}

export const waitForText = (text) => ab('wait', '--text', text);
export const waitFor = (selector) => ab('wait', selector);

/** Centre of the first element matching a CSS selector, in viewport coordinates. */
export function centerOf(selector, { dx = 0, dy = 0 } = {}) {
    const box = evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);

    if (!box) {
        throw new Error(`No element for ${selector}`);
    }

    return { ...box, x: Math.round(box.x + dx), y: Math.round(box.y + dy) };
}

let pointer = { x: 200, y: 700 };

/** Move the pointer along a human, eased curve. Duration scales with distance unless given. */
export async function moveTo(x, y, { duration } = {}) {
    const distance = Math.hypot(x - pointer.x, y - pointer.y);
    const ms = duration ?? Math.round(Math.min(1100, Math.max(380, 260 + distance * 1.1)));
    ab('mouse', 'move', String(Math.round(x)), String(Math.round(y)), '--human', '--seed', String(Math.floor(between(1, 9999))), '--duration', String(ms));
    pointer = { x, y };
}

export async function moveToSelector(selector, options = {}) {
    const box = centerOf(selector, options);
    await moveTo(box.x, box.y, options);

    return box;
}

/** Hover a beat, then press and release, like someone who read the button first. */
export async function click(selector, { settle = 260, ...options } = {}) {
    await moveToSelector(selector, options);
    await sleep(settle + between(0, 140));
    ab('mouse', 'down', 'left');
    await sleep(between(60, 110));
    ab('mouse', 'up', 'left');
}

/**
 * Type into whatever has focus at a relaxed human pace: ~6.5 characters a second, a little longer
 * after spaces and punctuation, and the odd hesitation mid-sentence. agent-browser has no human typing.
 */
export async function typeText(text, { cps = 6.5 } = {}) {
    const base = 1000 / cps;

    for (const character of text) {
        ab('keyboard', 'type', character);
        let delay = base * between(0.65, 1.35);

        if (character === ' ') {
            delay += between(20, 90);
        }

        if (/[,.!?]/.test(character)) {
            delay += between(180, 360);
        }

        if (random() < 0.04) {
            delay += between(250, 500);
        }

        await sleep(delay);
    }
}

/** Ease-in-out scroll of an element (or the page when selector is null) by `distance` px. */
export async function smoothScroll(selector, distance, duration = 900) {
    evalJs(`(() => {
        const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.scrollingElement'};
        if (!el) return false;
        const start = el.scrollTop, t0 = performance.now(), d = ${distance}, ms = ${duration};
        const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const step = (now) => { const t = Math.min(1, (now - t0) / ms); el.scrollTop = start + d * ease(t); if (t < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
        return true;
    })()`);
    await sleep(duration + 120);
}

/** Press on a point, drag along a human curve, and let go: a swipe. */
export async function swipe(from, to, { duration = 420 } = {}) {
    await moveTo(from.x, from.y);
    await sleep(between(160, 260));
    ab('mouse', 'down', 'left');
    await sleep(between(40, 80));
    ab('mouse', 'move', String(Math.round(to.x)), String(Math.round(to.y)), '--human', '--seed', String(Math.floor(between(1, 9999))), '--duration', String(duration));
    pointer = to;
    ab('mouse', 'up', 'left');
}

/**
 * Turn on Chrome touch emulation (coarse pointer, 5 touch points) for as long as the returned child
 * process lives; it only lasts as long as a CDP session holds it. Kill the child when the segment ends.
 */
export function holdTouchEmulation() {
    const child = spawn(process.execPath, [path.join(SCRIPTS_DIR, 'cdp.mjs'), 'touch', 'on'], { stdio: ['ignore', 'pipe', 'inherit'] });

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('touch emulation did not start')), 10000);
        child.stdout.on('data', () => {
            clearTimeout(timer);
            resolve(child);
        });
        child.on('exit', (code) => reject(new Error(`touch emulation exited ${code}`)));
    });
}

const FINGER = readFileSync(path.join(SCRIPTS_DIR, 'finger.js'), 'utf8');

/** Draw the fingertip overlay (phone segments). Re-run after every navigation. */
export const showFinger = () => evalJs(FINGER);

/** Close any old browser and let it finish shutting down, or it takes the next one with it. */
export async function freshBrowser() {
    try {
        ab('close');
    } catch {
            /* no recording running; nothing to stop */
        }

    await sleep(3000);
}

/**
 * Open a page at a viewport and colour scheme. The viewport must be set after `open`: setting it
 * first relaunches the browser and the page is lost.
 */
export function openAt(url, { w, h, scale = 2 }, theme = 'light') {
    ab('open', url);
    ab('set', 'viewport', String(w), String(h), String(scale));
    ab('set', 'media', theme);
    ab('reload');
}

export const readUrls = () => JSON.parse(readFileSync(path.join(DEMO_DIR, 'urls.json'), 'utf8'));

/**
 * Show a real email the app sent (its HTML, saved from the project's dev mailer) inside a phone mail-app
 * screen, so the video films the real email rather than a mockup.
 */
export async function openEmail(htmlFile, subject, { theme = 'light', from = 'The app', to = 'you' } = {}) {
    const out = execFileSync('python3', [path.join(SCRIPTS_DIR, 'make-email.py'), '--html', htmlFile, '--subject', subject, '--theme', theme, '--from', from, '--to', to], { encoding: 'utf8' }).trim();
    ab('open', `file://${out}`);
    await sleep(400);
}

/**
 * One take: recorded segments, each with beats timed to their voice lines.
 * Voice durations come from <take>/vo/lines.json; recordings and timeline.json go to <take>/<theme>/.
 */
export function createTake(takeDir, theme) {
    const linesFile = path.join(takeDir, 'vo', 'lines.json');

    if (!existsSync(linesFile)) {
        throw new Error(`No ${linesFile}: generate the voice first (voice-local.mjs ${takeDir}).`);
    }

    const voice = Object.fromEntries(JSON.parse(readFileSync(linesFile, 'utf8')).map((line) => [line.id, line.dur]));
    const out = path.join(takeDir, theme);
    mkdirSync(out, { recursive: true });
    const segments = [];
    let t0 = 0;
    let beats = [];
    const now = () => (performance.now() - t0) / 1000;

    return {
        /** frame: 'phone' (rounded phone on a plain background) or 'window' (rounded desktop window). */
        startSegment(name, viewport, { frame = viewport.w <= 600 ? 'phone' : 'window', cursor = frame === 'window', fps = 60 } = {}) {
            ab('record', 'start', path.join(out, `raw-${name}.mp4`), '--fps', String(fps), ...(cursor ? ['--cursor'] : []));
            t0 = performance.now();
            beats = [];
            segments.push({ name, frame, file: `raw-${name}.mp4`, viewport, beats });
        },

        /**
         * Run `act` while voice line `id` plays, then wait until the line (plus `tail`) has finished.
         * `after` runs at that moment: use it to land an action exactly as a line ends. A negative
         * tail makes `after` fire before the line is quite over.
         */
        async beat(id, act, { lead = 0.15, tail = 0.45, after } = {}) {
            if (!(id in voice)) {
                throw new Error(`No voice line "${id}" in ${linesFile}`);
            }

            const start = now();
            beats.push({ id, start: Number((start + lead).toFixed(3)) });
            await act();
            const left = start + lead + voice[id] + tail - now();

            if (left > 0) {
                await sleep(left * 1000);
            }

            if (after) {
                await after();
            }
        },

        stopSegment() {
            ab('record', 'stop');
        },

        save() {
            writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ theme, segments }, null, 1));
            console.log(JSON.stringify(segments.map((s) => ({ name: s.name, beats: s.beats.map((b) => b.id).join(',') }))));
        },
    };
}
