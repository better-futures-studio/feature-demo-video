// Small audio and JSON helpers shared by the voice scripts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

/** Spoken words in a line; <tags> don't count. */
export const words = (text) => text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
export const wpm = (text, seconds) => (words(text) / seconds) * 60;

export const duration = (file) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

/** Cut leading and trailing silence, fade in briefly, and write 44.1 kHz mono. */
export function trimClip(src, dst) {
    execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', src, '-af',
        'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,afade=t=in:d=0.04',
        '-ar', '44100', '-ac', '1', dst]);
}
