---
name: feature-demo-video
description: Record a casual "developer shows the team a feature" demo video of any web app running locally — rough first-person voiceover cloned on this Mac (the developer's own voice if they recorded a sample, otherwise a bundled default voice), human-paced browser recording of the real flow on phone and/or desktop, composed to 1080p in light and dark, and optionally shared to a phone over Tailscale. Use when someone asks to "record a demo video of this feature", "show the team" a feature, a "walkthrough video", a "demo video with voiceover", to clone their voice for demos, or to re-take or revise a demo. Not for polished marketing videos or PR screenshots.
---

# Feature demo videos

A developer showing their team a feature they just built: the real app, driven like a person would drive it, with a casual first-person voice over it. Everything runs on this machine: plan → isolated app → voice → record each segment with agent-browser → compose with ffmpeg → share.

Read `references/learnings.md` before planning; it holds the style decisions and every trap the first demos hit. Read `references/voices.md` before generating voice. `examples/catch-up/` is a complete worked example from another app; read it as a pattern.

`S` below is this skill's directory (where this SKILL.md lives). `DEMO_DIR` defaults to `/tmp/feature-demo`; nothing in it is ever committed.

## Requirements

macOS on Apple Silicon (the voice runs on MLX), Node 22+, Python 3 (on a fresh Mac, `python3` first prompts to install the Xcode Command Line Tools), `ffmpeg`, `uv` (`brew install uv ffmpeg`), and `agent-browser` 0.38+ (`npm i -g agent-browser && agent-browser install`). Tailscale only for sharing. Check these first and tell the user exactly what's missing.

## What the video is

- **Casual, first person, a bit rough.** "Hey everyone. So, um, I want to show you…". A teammate talking, not a narrator or an ad.
- **Narration order:** what it is → how the user gets to it → the overall benefit and where it's going (say plainly what isn't built yet) → walk through what the user can do → the important behavior (limits, undo, expiry, what's public, what happens to skipped items) → a short sign-off ("That's it, let me know what you think.").
- **No music, no captions, no title card.**
- **Voice: a local clone** (`voice-local.mjs`, Qwen3-TTS 1.7B on MLX, free, nothing leaves the machine). It speaks in the developer's own voice when they have recorded a sample, otherwise in the bundled default voice (`assets/`).
- **Offer to clone the developer's voice** the first time they make a demo without a sample: "Want it in your own voice? Record about 20 s and I'll set it up." Their sample stays on their machine.
- **Audition voice changes as audio first.** Share full-narration audio and let the user listen before re-recording any video.
- **Mobile first when the feature is mobile-first,** then a short desktop pass showing only what's different. **Light and dark takes.**
- **Show every real screen the flow touches:** the real email if one is sent, the expired/error/empty screens, the done state.
- **Don't transcribe or grade the voice unless asked;** the user checks by ear. Say you can't hear audio.

## Safety first

Record only against a local copy of the app with its own throwaway database and fake data. Never production, staging with real users, or real credentials.

Before recording, read the flow's code and list every external call it can make (APIs, payments, SMS, email, storage, DNS, webhooks, AI). Each must be switched off, pointed at a local mock, or caught by a dev mailer (Mailpit, a log mailer, letter_opener). If one can't be isolated, stop and ask. Seed only fictional people and businesses with reserved `.test` emails and domains. If the project has its own rules about tests and live services (CLAUDE.md, AGENTS.md), they apply to every step here.

## Workflow

### 1. Plan the beats and narration with the user

Read the feature's code (pages, components, routes, mail) for the real screens, labels, test ids and limits. Show the user a beat table before building anything:

| Id | Segment | On screen / action | Line |
|----|---------|--------------------|------|
| A | phone | First screen; finger drifts to the main element | Hey everyone. So, um, I want to show you… what it is, why |
| A2 | phone | Hold | How they get to it; where it's going; what's not built yet |
| B | phone | First real action | What they can do… |
| … | … | Limits, undo, expiry, error screens, the real email | … |
| K | desktop | Only what differs on desktop | And on desktop… |
| J | desktop | Hold | That's it, let me know what you think. |

One or two sentences per beat; the beat lasts as long as its line. Write it to `$DEMO_DIR/take/script.json` as `[{ "id", "text" }]` (see `examples/catch-up/script.json`). Plan any action that should land as a line ends.

### 2. The app, isolated

Use the project's own way to run it locally, pointed at a separate demo database. Work out, with the user if it's unclear:

- **Reset + seed:** one command that wipes the demo database, seeds the records every beat needs, and writes `$DEMO_DIR/urls.json` with the URLs and logins the driver uses (e.g. `{"start_url": "...", "login_url": "...", "login_email": "dana@example.test", "login_password": "..."}`). Run it before every take, since takes change data.
- **Serve:** the app on `127.0.0.1` with production-like built assets (no hot-reload dev server that can drop out mid-take), plus any local mocks. Run it in the background and log to `$DEMO_DIR`.
- **Isolation check:** confirm the running app really uses the demo database and mocks (env overrides can be dropped by dev servers). After a take, check the mock and mailer logs: every external call should be there.

Keep these scripts in `$DEMO_DIR` unless the user wants them in the project.

### 3. Voice

```bash
bash $S/scripts/setup-local-voice.sh                            # once per machine: venv + models (~5 GB, under ~/.cache)
node $S/scripts/voice-local.mjs $DEMO_DIR/take             # → take/vo/<id>.wav + take/vo/lines.json (durations)
REGEN=C,D node $S/scripts/voice-local.mjs $DEMO_DIR/take   # re-take chosen lines; unchanged lines are kept
```

It prints which voice it used: the developer's sample from `~/.config/feature-demo-video/voice/` if there is one, otherwise the bundled default. A clone takes no style direction: delivery follows the sample, so a lively sample gives a lively narration. Pace belongs to the voice: a `sample.tempo` file beside a sample (e.g. `1.15`) speeds it up; `TEMPO=` overrides it for one run; `MAX_WPM` (off by default) caps it. Re-pacing reuses the raw takes. Voice comes before recording because beats are timed to it.

**Cloning the developer's own voice** (details in `references/voices.md`): they record 15–30 s of themselves at their demo pace (iPhone Voice Memos, quiet room) and send you the file. Run `bash $S/scripts/prepare-voice-sample.sh <recording> ["exact transcript"]`. It trims and levels the clip into their private sample folder and transcribes it locally if no transcript is given; read the transcript and fix every wrong word. Then generate a narration and let them listen before recording video. If the clone reads flat, audition `TEMPO=1.08` and `TEMPO=1.15` and save their pick in `sample.tempo`.

To audition, generate the full narration into a separate take dir and join it into one track (`ffmpeg -nostdin -f concat -safe 0 -i list.txt -c:a aac track.m4a`), then share it (step 6) or give the user the file.

### 4. Drive and record each segment

Copy `templates/driver.mjs` to `$DEMO_DIR/driver.mjs` and write the beats (`examples/catch-up/driver.mjs` shows every technique). Feature-specific selectors live in the driver; `scripts/lib.mjs` has the helpers: `freshBrowser`, `openAt`, `centerOf`, `moveTo`/`moveToSelector`/`click`/`swipe`/`typeText`/`smoothScroll`, `holdTouchEmulation`, `showFinger`, `waitFor`/`waitForText`, `evalJs`, `openEmail`, `readUrls`, and `createTake` (`startSegment`, `beat(id, act, { lead, tail, after })`, `stopSegment`, `save`).

```bash
DEMO_LIB=$S/scripts/lib.mjs TAKE=$DEMO_DIR/take THEME=light node $DEMO_DIR/driver.mjs
<reset + seed>
DEMO_LIB=$S/scripts/lib.mjs TAKE=$DEMO_DIR/take THEME=dark node $DEMO_DIR/driver.mjs
```

Each run writes `take/<theme>/raw-<segment>.mp4` and `take/<theme>/timeline.json`. Before composing, pull a few frames (`ffmpeg -nostdin -ss <t> -i raw-phone.mp4 -frames:v 1 f.png`) and look: right screen, finger where the line says, nothing cut off.

To film a sent email: save its HTML from the dev mailer (Mailpit's API, a log file, …) and call `openEmail(htmlFile, subject, { theme, from, to })`; it shows the real email in a phone mail screen with links opening in place.

### 5. Compose

```bash
bash $S/scripts/compose.sh $DEMO_DIR/take light $DEMO_DIR/share/<feature>-team-demo-light.mp4
bash $S/scripts/compose.sh $DEMO_DIR/take dark  $DEMO_DIR/share/<feature>-team-demo-dark.mp4
```

Phone segments become a rounded phone with a shadow on a plain background, desktop segments a rounded window; voice clips land at their beat starts; segments crossfade 0.4 s. Check frames from the finished file (each segment, each transition) before sharing.

### 6. Share

Give the user the file paths. To watch on their phone over Tailscale:

```bash
node $S/scripts/serve-share.mjs $DEMO_DIR/share 8787 "<Feature> · team demo"   # run in the background
```

It binds only to the Tailscale address, prints the MagicDNS URL, and lists the videos and audio tracks with Range support for iOS.

### 7. Iterate

The user watches and gives notes. Change `script.json`, re-take only the changed lines (`REGEN=`), adjust beats, reset, re-record both themes, re-compose, and replace the shared files. Report what changed and that you can't hear the audio.

## Don'ts

- Don't point a demo at anything but a local, throwaway database, give it real credentials, or let a mutating third-party call leave the machine.
- Don't add music, captions, a title card, or a narrator voice.
- Don't claim a feature does something it doesn't yet; say "we don't … yet".
- Don't mock screens the app really has (the email, the expired page): film the real ones.
- Don't re-record video to try a new voice: audition it as audio first.
- Don't set the viewport before `open`, use `Emulation.setEmitTouchEventsForMouse`, or reopen the browser without the ~3 s wait (`freshBrowser`).
- Don't run ffmpeg without `-nostdin` in scripts. Don't serve on `0.0.0.0` or the LAN.
- Don't commit videos, voice clips or `DEMO_DIR` contents, and never a person's voice sample: it lets anyone make speech in their voice.
- Don't clone anyone's voice but the developer's own, and only when they ask for it.

## Files

- `scripts/lib.mjs` — agent-browser helpers and the take/beat timeline; `cdp.mjs` holds touch emulation; `finger.js` is the fingertip overlay; `ab` wraps agent-browser on the demo session for poking by hand.
- `scripts/voice-local.mjs` with `voice_clone.py`, `audio.mjs`, `local-voice-env.sh`, `setup-local-voice.sh`, `prepare-voice-sample.sh`; `assets/zubenelgenubi-sample.{wav,txt}` is the default voice.
- `scripts/make-email.py` — a sent email in a phone mail screen. `scripts/compose.sh` — the finished video. `scripts/serve-share.mjs` — sharing.
- `templates/driver.mjs` — starting point. `examples/catch-up/` — worked example. `references/learnings.md`, `references/voices.md`.
