"""Batch voice clone for voice-local.mjs: reads a JSON job list [{"text", "out"}] on stdin and writes
each line to its "out" WAV, in the voice of SAMPLE_WAV (with its transcript SAMPLE_TXT), using a
Qwen3-TTS Base model on MLX (LOCAL_TTS_MODEL). One model load for the whole narration; one JSON line
per clip on stdout."""
import json
import os
import sys
import time

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

ref = dict(
    ref_audio=os.environ["SAMPLE_WAV"],
    ref_text=open(os.environ["SAMPLE_TXT"]).read().strip(),
    lang_code="english",
)
jobs = json.load(sys.stdin)
model = load_model(os.environ["LOCAL_TTS_MODEL"])

for job in jobs:
    started = time.perf_counter()
    pieces = [np.array(r.audio, dtype=np.float32).reshape(-1) for r in model.generate(text=job["text"], **ref)]
    sf.write(job["out"], np.concatenate(pieces), model.sample_rate)
    print(json.dumps({"out": job["out"], "gen_s": round(time.perf_counter() - started, 1)}), flush=True)
