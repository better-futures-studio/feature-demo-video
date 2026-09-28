#!/usr/bin/env bash
# Turn a recording of the developer (e.g. an iPhone Voice Memo, 15-30 s of natural speech) into the clone
# sample: trimmed, 24 kHz mono, level-matched, at $VOICE_SAMPLE_DIR/sample.wav. The transcript goes to
# sample.txt: the text you pass, or a local transcription to check and correct by hand (a wrong word in
# it makes the clone worse). Nothing leaves the machine.
# usage: prepare-voice-sample.sh <recording> ["exact transcript"]
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPTS/local-voice-env.sh"

if [ $# -lt 1 ] || [ ! -f "$1" ]; then
    echo 'usage: prepare-voice-sample.sh <recording> ["exact transcript"]' >&2
    exit 64
fi

mkdir -p "$VOICE_SAMPLE_DIR"
chmod 700 "$VOICE_SAMPLE_DIR"
ffmpeg -nostdin -v error -y -i "$1" -ac 1 -ar 24000 \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse,loudnorm=I=-18:TP=-2" \
    "$VOICE_SAMPLE_DIR/sample.wav"

# The transcript is written to a temporary file and moved into place only when it has text: an empty
# sample.txt would make voice-local.mjs clone with no transcript.
transcript="$VOICE_SAMPLE_DIR/sample.txt.tmp"

if [ $# -ge 2 ]; then
    printf '%s\n' "$2" > "$transcript"
else
    "$FDV_VENV/bin/python" -c '
import sys
from mlx_audio.stt.utils import load_model
print(load_model("mlx-community/parakeet-tdt-0.6b-v3").generate(sys.argv[1]).text.strip())
' "$VOICE_SAMPLE_DIR/sample.wav" > "$transcript"
    echo "Transcribed; check it and fix any wrong word: $VOICE_SAMPLE_DIR/sample.txt"
fi

if ! grep -q '[[:alnum:]]' "$transcript"; then
    rm -f "$transcript" "$VOICE_SAMPLE_DIR/sample.wav"
    echo "No transcript; nothing was saved. Pass the exact words as the second argument." >&2
    exit 1
fi

mv "$transcript" "$VOICE_SAMPLE_DIR/sample.txt"

# The pace set for the previous sample stays with the voice; a new, quicker recording may not need it.
if [ -f "$VOICE_SAMPLE_DIR/sample.tempo" ]; then
    echo "Kept this voice's speed-up, x$(cat "$VOICE_SAMPLE_DIR/sample.tempo") (sample.tempo). If the new recording is already quicker, delete that file or try TEMPO=1 first."
fi

seconds=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VOICE_SAMPLE_DIR/sample.wav")
echo "Sample: $VOICE_SAMPLE_DIR/sample.wav (${seconds%.*} s)"
cat "$VOICE_SAMPLE_DIR/sample.txt"
