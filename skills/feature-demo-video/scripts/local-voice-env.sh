# Source this. Where the local voice lives: the Python environment and model cache (rebuildable, under
# ~/.cache) and the developer's own voice sample, if they recorded one (personal, under ~/.config). Never
# copy a person's sample into the repo: anyone holding it can make speech in that person's voice. Without
# one, the clone uses the skill's bundled sample, the Gemini Zubenelgenubi voice.
export FDV_HOME="${FDV_HOME:-$HOME/.cache/feature-demo-video}"
export FDV_VENV="${FDV_VENV:-$FDV_HOME/venv}"
export VOICE_SAMPLE_DIR="${VOICE_SAMPLE_DIR:-$HOME/.config/feature-demo-video/voice}"
export LOCAL_TTS_MODEL="${LOCAL_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16}"
export MLX_AUDIO_VERSION="${MLX_AUDIO_VERSION:-0.5.6}"
