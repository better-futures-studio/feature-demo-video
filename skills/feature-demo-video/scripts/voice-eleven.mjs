// ElevenLabs voice for demos in languages the local clone can't do (Arabic: Qwen3-TTS is poor at it).
// Same contract as voice-local.mjs: one clip per line of <take>/script.json -> <take>/vo/<id>.wav and
// <take>/vo/lines.json, so the driver and compose.sh don't care which engine ran. Cloud: the text is sent to
// ElevenLabs and costs credits. Default model is eleven_v3, which acts on audio tags written in the line
// text: "[excited] Look at this! [laughs] I love it." (<tag> is accepted too and sent as [tag]).
// `style` in script.json is ignored. v3 drifts a bit between clips, so re-take single lines with REGEN.
// env: ELEVENLABS_API_KEY (required; or put ELEVENLABS_API_KEY=... in ~/.config/feature-demo-video/elevenlabs.env,
// mode 600), ELEVENLABS_VOICE (a name from assets/eleven-voices.json, Egyptian voices grouped male/female; default masry; ELEVENLABS_VOICE_ID takes a raw id, e.g. one from your Voice Library), ELEVENLABS_MODEL (default eleven_v3; eleven_multilingual_v2 has no tags),
// ELEVENLABS_LANG (optional ISO code; default ar), TEMPO (default 1), STABILITY (v3 only takes 0, 0.5 or 1: Creative/Natural/Robust; default 0.5), REGEN=all|A,B.
// usage: node voice-eleven.mjs <take-dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { duration, readJson, trimClip, wpm, writeJson } from './audio.mjs';

// The key lives outside the repo, next to the voice sample; the environment wins.
const envFile = path.join(process.env.HOME, '.config/feature-demo-video/elevenlabs.env');
const fileKey = fs.existsSync(envFile) && fs.readFileSync(envFile, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1].trim();
const key = process.env.ELEVENLABS_API_KEY ?? fileKey;
const catalog = readJson(path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/eleven-voices.json'));
const { default: fallback, ...groups } = catalog;
const names = Object.fromEntries(Object.values(groups).flatMap(Object.entries));
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? names[(process.env.ELEVENLABS_VOICE ?? fallback).toLowerCase()];
const model = process.env.ELEVENLABS_MODEL ?? 'eleven_v3';
const lang = process.env.ELEVENLABS_LANG ?? 'ar';
const tempo = Number(process.env.TEMPO ?? 1);
const stability = Number(process.env.STABILITY ?? 0.5);

if (!process.argv[2] || !key || !voiceId) {
    console.error('usage: ELEVENLABS_VOICE=<name> node voice-eleven.mjs <take-dir>   (key in env or ' + envFile + ')');
    console.error(Object.entries(groups).map(([group, v]) => `${group}: ${Object.keys(v).join(', ')}`).join('\n'));
    if (!key) console.error('No ELEVENLABS_API_KEY found.');
    process.exit(64);
}

if (!(tempo >= 0.5 && tempo <= 2)) {
    console.error(`TEMPO must be between 0.5 and 2 (got "${process.env.TEMPO}").`);
    process.exit(64);
}

const dir = path.resolve(process.argv[2]);
const vo = path.join(dir, 'vo');
fs.mkdirSync(vo, { recursive: true });
const lines = readJson(path.join(dir, 'script.json'));

// ElevenLabs is for Arabic only (it costs credits); everything else uses the free local voice.
if (!lines.some((l) => /\p{Script=Arabic}/u.test(l.text))) {
    console.error('No Arabic in script.json. English and other languages use voice-local.mjs; ElevenLabs is for Arabic only.');
    process.exit(64);
}
const previous = fs.existsSync(path.join(vo, 'lines.json')) ? readJson(path.join(vo, 'lines.json')) : [];
const regen = new Set((process.env.REGEN ?? '').split(',').filter(Boolean));
const v3 = model === 'eleven_v3';
// v3 keeps audio tags ([excited]); other models would read them aloud, so they're stripped.
const spoken = (text) => (v3 ? text.replace(/<([^>]+)>/g, '[$1]') : text.replace(/<[^>]+>|\[[^\]]+\]/g, ' ')).replace(/\s+/g, ' ').trim();
const voice = `eleven:${voiceId}`;

const keep = (line) => {
    const prior = previous.find((p) => p.id === line.id);

    return fs.existsSync(path.join(vo, `${line.id}.raw.mp3`)) && prior?.text === line.text && prior?.voice === voice && prior?.model === model && !regen.has('all') && !regen.has(line.id);
};

const out = [];

for (const [i, line] of lines.entries()) {
    const raw = path.join(vo, `${line.id}.raw.mp3`);
    const kept = keep(line);

    if (!kept) {
        // Neighbouring lines as context keep tone steady (v3 rejects these fields).
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: { 'xi-api-key': key, 'content-type': 'application/json' },
            body: JSON.stringify({
                text: spoken(line.text),
                model_id: model,
                ...(lang && { language_code: lang }),
                ...(!v3 && i > 0 && { previous_text: spoken(lines[i - 1].text) }),
                ...(!v3 && i < lines.length - 1 && { next_text: spoken(lines[i + 1].text) }),
                voice_settings: { stability, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
            }),
        });

        if (!res.ok) {
            console.error(`ElevenLabs ${res.status} on line ${line.id}: ${await res.text()}\nNothing saved to lines.json; fix it and run this again.`);
            process.exit(1);
        }

        fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    }

    const clip = path.join(vo, `${line.id}.wav`);
    const trimmed = `${clip}.trim.wav`;
    trimClip(raw, trimmed);

    try {
        execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', trimmed, '-filter:a', `atempo=${tempo.toFixed(3)}`, clip]);
    } finally {
        fs.rmSync(trimmed, { force: true });
    }

    const dur = duration(clip);
    out.push({ ...line, voice, model, tempo, dur });
    console.log(`${line.id}  ${kept ? 'kept' : 'new '}  ${dur.toFixed(2)}s  ${Math.round(wpm(line.text, dur))} wpm`);
}

writeJson(path.join(vo, 'lines.json'), out);
