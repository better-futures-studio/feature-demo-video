# feature-demo-video

A Claude Code and Codex skill for recording "developer shows the team a feature" videos of any web app running locally. The agent plans the narration with you, generates a casual voiceover on your Mac, drives the real app in a browser at a human pace (phone and desktop), and composes 1080p videos in light and dark.

The voice is cloned locally with Qwen3-TTS (free, nothing leaves your machine). It uses your own voice if you record a sample, otherwise a bundled default voice.

## Requirements

- macOS on Apple Silicon (the voice model runs on MLX)
- Node 22+, Python 3, `ffmpeg`, `uv`: `brew install ffmpeg uv` (on a fresh Mac, `python3` first prompts to install the Xcode Command Line Tools)
- [agent-browser](https://www.npmjs.com/package/agent-browser) 0.38+: `npm i -g agent-browser && agent-browser install`
- Optional: Tailscale, to watch videos on your phone

## Install

### Claude Code

As a plugin (updates through `/plugin`):

```
/plugin marketplace add better-futures-studio/feature-demo-video
/plugin install feature-demo-video@better-futures-studio
```

Or as a plain skill, with the script below.

### Codex (and Claude Code without the plugin)

```bash
git clone https://github.com/better-futures-studio/feature-demo-video.git ~/.local/share/feature-demo-video
```

```bash
~/.local/share/feature-demo-video/install.sh
```

That links the skill into `~/.claude/skills` and `~/.codex/skills` (or `$CODEX_HOME/skills`). Pass `--claude` or `--codex` for just one. Pick either the plugin or the script for Claude Code, not both. To update, `git pull` in the clone.

### Voice model (once per Mac)

```bash
bash ~/.local/share/feature-demo-video/skills/feature-demo-video/scripts/setup-local-voice.sh
```

It makes a Python environment under `~/.cache/feature-demo-video` and downloads about 5 GB of models. If you installed the plugin, ask the agent to run this; it knows where the skill lives.

## Use

In your project, ask the agent something like "record a demo video of the new export feature for the team". It will:

1. Read the feature's code and show you a beat-by-beat script to approve.
2. Work out with you how to run the app against a throwaway local database with fake data, with every external service mocked or switched off. It won't record against production or real credentials.
3. Generate the voice, record each segment, and compose light and dark videos into `/tmp/feature-demo/share/`.

## Your own voice

Ask the agent to "clone my voice for demos". Record 15–30 seconds of yourself talking at your normal demo pace (iPhone Voice Memos in a quiet room is fine) and give it the file. It trims the clip, transcribes it locally, and asks you to check the transcript. The sample is kept in `~/.config/feature-demo-video/voice/` on your Mac only. Delete that folder to go back to the default voice.

Only clone your own voice. Never commit a voice sample or share one: anyone holding it can make speech in your voice.

## License

MIT. The voice models download at setup under their own licences (Qwen3-TTS: Apache-2.0, parakeet-tdt: CC-BY-4.0).
