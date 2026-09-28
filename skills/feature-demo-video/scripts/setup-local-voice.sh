#!/usr/bin/env bash
# One-time setup for the local voice (Apple Silicon only: it runs on MLX): a Python venv with mlx-audio
# under $FDV_VENV, then a download of the clone model (~4 GB into the Hugging Face cache) and the small
# speech-to-text model prepare-voice-sample.sh uses. Safe to re-run; it only installs what is missing.
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPTS/local-voice-env.sh"

if [ "$(uname -s)-$(uname -m)" != "Darwin-arm64" ]; then
    echo "The local voice needs an Apple Silicon Mac (MLX). There is no other voice path yet." >&2
    exit 1
fi

command -v uv >/dev/null || { echo "Install uv first: brew install uv" >&2; exit 1; }
mkdir -p "$FDV_HOME"

if [ ! -x "$FDV_VENV/bin/python" ]; then
    uv venv --python 3.12 "$FDV_VENV"
fi

if ! "$FDV_VENV/bin/python" -c 'import importlib.metadata as m, sys; sys.exit(0 if m.version("mlx-audio") == sys.argv[1] else 1)' "$MLX_AUDIO_VERSION" 2>/dev/null; then
    uv pip install --python "$FDV_VENV/bin/python" "mlx-audio==$MLX_AUDIO_VERSION" soundfile
fi

"$FDV_VENV/bin/python" -c '
import sys
from huggingface_hub import snapshot_download
for repo in sys.argv[1:]:
    print(repo, "->", snapshot_download(repo))
' "$LOCAL_TTS_MODEL" mlx-community/parakeet-tdt-0.6b-v3
echo "Local voice ready. Next: record a sample and run prepare-voice-sample.sh (see references/voices.md)."
