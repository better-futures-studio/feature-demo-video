// The voice for team demos, cloned on this Mac: the developer's own voice when they have recorded
// a sample (prepare-voice-sample.sh, kept outside the repo), otherwise the skill's bundled sample of the
// Gemini Zubenelgenubi voice (assets/). One clip per line of <take>/script.json, written to
// <take>/vo/<id>.wav and <take>/vo/lines.json (durations), which the driver and compose.sh read. The clone is Qwen3-TTS 1.7B Base on MLX (setup-local-voice.sh). It
// takes no style direction: delivery follows the sample, so `style` in script.json is ignored and <tags>
// are stripped. The pace belongs to the voice: a sample can carry a speed-up next to it (sample.tempo, e.g.
// 1.15 for a developer whose clone reads flat), a voice without one plays at its natural pace, and TEMPO
// overrides both for one run (pitch preserved). MAX_WPM (off by default) caps the pace, slowing a line no
// further than MIN_TEMPO. Each final clip is rebuilt from its raw take, so re-pacing never re-voices.
// usage: node voice-local.mjs <take-dir>      REGEN=all|A,B re-takes; keeps unchanged lines.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { duration, readJson, trimClip, wpm, writeJson } from './audio.mjs';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));

/** A speed factor from the environment or a .tempo file, or exit when it isn't between 0.5 and 2. */
function speedFactor(name, raw) {
    const value = Number(raw);

    if (!(value >= 0.5 && value <= 2)) {
        console.error(`${name} must be a number between 0.5 and 2 (got "${raw ?? ''}").`);
        process.exit(64);
    }

    return value;
}

const MIN_TEMPO = speedFactor('MIN_TEMPO', process.env.MIN_TEMPO ?? 0.85);
// The optional pace cap: unset or 0 means off; anything else must be a positive number, so a typo fails
// here instead of silently switching the cap off.
const MAX_WPM = Number(process.env.MAX_WPM ?? 0);

if (!(MAX_WPM >= 0)) {
    console.error(`MAX_WPM must be a positive number of words a minute, or 0 for no cap (got "${process.env.MAX_WPM}").`);
    process.exit(64);
}

if (!process.argv[2]) {
    console.error('usage: node voice-local.mjs <take-dir>');
    process.exit(64);
}

/** Run a shell command with local-voice-env.sh sourced, so Node and the shell scripts agree on every path. */
const withEnv = (command, options = {}) => execFileSync('bash', ['-c', `. "${SCRIPTS}/local-voice-env.sh" && ${command}`], { encoding: 'utf8', ...options });
const [venv, sampleDir, model] = withEnv('printf "%s\\n%s\\n%s" "$FDV_VENV" "$VOICE_SAMPLE_DIR" "$LOCAL_TTS_MODEL"').split('\n');

if (!fs.existsSync(path.join(venv, 'bin', 'python'))) {
    console.error(`No local voice environment at ${venv}. Run setup-local-voice.sh first (Apple Silicon only).`);
    process.exit(1);
}

// The developer's own sample wins; the bundled Gemini sample is everyone's default.
const own = { wav: path.join(sampleDir, 'sample.wav'), txt: path.join(sampleDir, 'sample.txt'), label: 'your recorded voice' };
const bundled = { wav: path.join(SCRIPTS, '../assets/zubenelgenubi-sample.wav'), txt: path.join(SCRIPTS, '../assets/zubenelgenubi-sample.txt'), label: 'the bundled Gemini Zubenelgenubi sample' };
const hasText = (file) => fs.existsSync(file) && /[a-z0-9]/i.test(fs.readFileSync(file, 'utf8'));
const sample = fs.existsSync(own.wav) && hasText(own.txt) ? own : bundled;
// The voice's own pace: <sample>.tempo beside the sample (sample.tempo for the developer's own voice),
// else 1 (its natural pace). TEMPO overrides it for one run.
const tempoFile = sample.wav.replace(/\.wav$/, '.tempo');
const TEMPO = process.env.TEMPO !== undefined
    ? speedFactor('TEMPO', process.env.TEMPO)
    : fs.existsSync(tempoFile) ? speedFactor(tempoFile, fs.readFileSync(tempoFile, 'utf8').trim()) : 1;
console.log(`Voice: ${sample.label} (${sample.wav}), pace x${TEMPO}${process.env.TEMPO !== undefined ? ' (TEMPO)' : fs.existsSync(tempoFile) ? ` (${path.basename(tempoFile)})` : ''}`);

// Lines are re-taken when the sample or model changes, not just the text.
const voice = `local:${createHash('sha256').update(fs.readFileSync(sample.wav)).update(fs.readFileSync(sample.txt)).digest('hex').slice(0, 12)}`;
const dir = path.resolve(process.argv[2]);
const vo = path.join(dir, 'vo');
fs.mkdirSync(vo, { recursive: true });
const lines = readJson(path.join(dir, 'script.json'));

if (lines.some((l) => /\p{Script=Arabic}/u.test(l.text))) {
    console.error('script.json has Arabic, which Qwen reads badly. Use voice-eleven.mjs for Arabic narration.');
    process.exit(64);
}
const previous = fs.existsSync(path.join(vo, 'lines.json')) ? readJson(path.join(vo, 'lines.json')) : [];
const regen = new Set((process.env.REGEN ?? '').split(',').filter(Boolean));
const spoken = (text) => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const keep = (line) => {
    const prior = previous.find((p) => p.id === line.id);

    // The raw take is what gets re-paced, so a line is only kept when its raw take is still there.
    return fs.existsSync(path.join(vo, `${line.id}.raw.wav`)) && prior?.text === line.text && prior?.voice === voice && prior?.model === model && !regen.has('all') && !regen.has(line.id);
};

const jobs = lines.filter((line) => !keep(line)).map((line) => ({ id: line.id, text: spoken(line.text), out: path.join(vo, `${line.id}.raw.wav`) }));

if (jobs.length > 0) {
    // One model load for every line; progress goes to the terminal as each clip lands. On a failure,
    // lines.json is left as it was, so a rerun voices this whole batch again.
    try {
        withEnv(`exec "$FDV_VENV/bin/python" "${SCRIPTS}/voice_clone.py"`, {
            input: JSON.stringify(jobs),
            stdio: ['pipe', 'inherit', 'inherit'],
            env: { ...process.env, SAMPLE_WAV: sample.wav, SAMPLE_TXT: sample.txt },
        });
    } catch {
        console.error('The voice clone failed (see its output above). Nothing was saved to lines.json; fix it and run this again.');
        process.exit(1);
    }
}

const out = [];

for (const line of lines) {
    const clip = path.join(vo, `${line.id}.wav`);
    const kept = !jobs.some((j) => j.id === line.id);

    // Trim the raw take, then speed it up by TEMPO, or less when MAX_WPM caps the pace.
    const trimmed = `${clip}.trim.wav`;
    trimClip(path.join(vo, `${line.id}.raw.wav`), trimmed);
    const natural = wpm(line.text, duration(trimmed));
    let factor = TEMPO;

    if (MAX_WPM > 0 && natural * factor > MAX_WPM) {
        factor = Math.max(MIN_TEMPO, MAX_WPM / natural);
    }

    try {
        execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', trimmed, '-filter:a', `atempo=${factor.toFixed(3)}`, clip]);
    } finally {
        fs.rmSync(trimmed, { force: true });
    }
    const dur = duration(clip);
    out.push({ ...line, voice, model, tempo: Number(factor.toFixed(3)), dur });
    console.log(`${line.id}  ${kept ? 'kept' : 'new '}  ${dur.toFixed(2)}s  ${Math.round(wpm(line.text, dur))} wpm  (x${factor.toFixed(2)})`);
}

writeJson(path.join(vo, 'lines.json'), out);
