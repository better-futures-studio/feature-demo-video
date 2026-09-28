# Voices

**The voice is a local clone (`voice-local.mjs`): Qwen3-TTS 1.7B Base on MLX, in the developer's own voice when they have recorded a sample, otherwise the default voice in `assets/zubenelgenubi-sample.wav`.** Don't re-run the auditions below unless the user asks for a different voice.

## Local clone

- **Engine:** `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16` through `mlx-audio` 0.5.6, Apache-2.0. `setup-local-voice.sh` makes a venv under `~/.cache/feature-demo-video/venv` and downloads the model (~4 GB) plus a small speech-to-text model into the Hugging Face cache. Apple Silicon only.
- **Which voice:** `~/.config/feature-demo-video/voice/sample.{wav,txt}` if the developer made one (`VOICE_SAMPLE_DIR` overrides), else the bundled sample. The script prints which it used.
- **The sample is the direction.** A clone takes no style text: it copies the sample's timbre, energy and pace. A slow, flat sample gives a slow, flat narration; a lively, natural sample gives a lively one.
- **Speed on an M4 with 16 GB:** about 1.1–1.5x real time, peak ~8 GB of memory. A 90 s narration takes about 2 minutes.
- **Pace belongs to the voice.** Samples clone at different paces (the bundled one at ~215 wpm, developers' own voices at ~180–206), so there is no global speed-up. A `.tempo` file beside a sample (`sample.tempo`) holds its speed-up, applied with a pitch-preserving `atempo`; a voice without one plays at its natural pace. `TEMPO=` overrides it for one run. The first developer compared their clone's own pace, +8% and +15%, and picked +15% (`1.15`); much past that sounds processed. Re-recording the sample a little quicker is the most natural alternative. `MAX_WPM` (off by default) caps the pace, slowing a line no further than `MIN_TEMPO` (0.85x). Final clips are rebuilt from `<id>.raw.wav` on every run, so re-pacing never re-voices.
- **Re-takes:** a line is kept when its text, the sample (hashed) and the model are unchanged. `REGEN=C,D` or `REGEN=all`.
- **Cost:** free; nothing leaves the machine.
- **The bundled sample** is 8.9 s of Gemini TTS (voice Zubenelgenubi) reading one demo line. It is generated speech, not a person, so it can ship with the skill.

## Cloning the developer's own voice

Offer this the first time someone makes a demo without a sample. Only ever clone the voice of the person asking.

1. **They record 15–30 s** at the pace and energy they want every demo to have: quiet room, no music or fan, phone a hand's width away; iPhone Voice Memos is fine. Reading a short script works; going on a little past it in their own words works even better. A script:
   > "Hey everyone, so I want to show you something we just shipped. It's right here on the settings page, next to the export button. Honestly, I'm really excited about this one, and I think people are going to love it."
2. **They send you the file** (attach it in the session, or AirDrop it to the Mac).
3. **Run** `scripts/prepare-voice-sample.sh <recording> ["exact transcript"]`. Without a transcript it transcribes locally; read `sample.txt` and fix every wrong word (product names come out wrong), because the clone uses it to line up the audio.
4. **Generate a full narration** into a scratch take and share it as one track. Re-record video only after they've listened.

The sample lives in `~/.config/feature-demo-video/voice/` (mode 700), never in a repo, `DEMO_DIR`, a PR or a chat upload you don't need: anyone holding it can make speech in their voice. To stop using it, delete that folder; the bundled voice takes over.

## Why this voice (don't redo it)

The first team wanted a rough, offhand teammate voice, consistent from line to line, free and private.

- **Cloud TTS was tried first.** A polished Gemini voice read as an ad. ElevenLabs `eleven_v3` drifted in tone and accent line to line; `eleven_multilingual_v2` with high stability, a fixed seed and request stitching was consistent but robotic. Gemini accent direction (Arabic, Egyptian) did not work. The pick was Gemini `Zubenelgenubi` with a rough "developer on a team call" style, and its daily quota ran out after one day of re-takes, which led to cloning locally.
- **Local audition (M4, 16 GB):** Qwen3-TTS 1.7B Base cloning was the pick (closest to the sample, natural, fast enough). Also tried: Qwen3-TTS 0.6B Base (faster, rougher), Qwen3-TTS CustomVoice (style text works but the preset voices read too high or garbled words), Chatterbox, VoxCPM2, Dia 1.6B (rushed, cut off endings), Fish Audio S2 Pro (rich emotion tags but ~4x slower than real time, 12 GB, and a licence that needs paying for commercial use).

**Audition as audio first.** Generate each candidate's full narration into its own take dir, join the clips into one track per candidate, share the tracks, and re-record video only after the user picks. `serve-share.mjs` lists only `.mp4`/`.m4a`/`.mp3`, so convert WAVs first.
