"""Synthesises the lines of a job file, one WAV each, and lists their lengths in tts.json.

Usage: python scripts/tts.py <job.json> <out-dir>    (called by scripts/voice.mjs)

Engines (both free, both run on a CPU, no account and no key):
  kokoro  Kokoro-82M, Apache-2.0 (https://huggingface.co/hexgrad/Kokoro-82M), English
  piper   Mana-Persian-Piper, MIT (https://huggingface.co/MahtaFetrat/Mana-Persian-Piper), Persian

Nothing here prints a line's text: the engines' own logging is switched off, and voice.mjs
keeps this process's whole output out of the build log anyway.
"""

import json
import logging
import pathlib
import sys
import warnings
import wave

warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)


def kokoro(voice, lines, out):
    from loguru import logger

    logger.remove()
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    rate = 24000
    pipeline = KPipeline(lang_code=voice["voice"][0], repo_id="hexgrad/Kokoro-82M")
    made = []
    for line in lines:
        chunks = []
        for result in pipeline(line["text"], voice=voice["voice"], speed=float(voice["speed"])):
            audio = result.audio
            audio = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            chunks.append(audio.astype(np.float32))
        audio = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
        name = f"{line['id']}.wav"
        sf.write(out / name, audio, rate)
        made.append({"id": line["id"], "file": name, "seconds": round(len(audio) / rate, 3)})
    return made


def piper(voice, lines, out):
    from piper import PiperVoice

    model = PiperVoice.load(voice["model"])
    scale = float(voice.get("lengthScale", 1.0))
    try:
        from piper import SynthesisConfig

        config = SynthesisConfig(length_scale=scale)

        def say(text, wav_file):
            model.synthesize_wav(text, wav_file, syn_config=config)

    except ImportError:  # piper-tts before 1.3

        def say(text, wav_file):
            model.synthesize(text, wav_file, length_scale=scale)

    made = []
    for line in lines:
        name = f"{line['id']}.wav"
        with wave.open(str(out / name), "wb") as wav_file:
            say(line["text"], wav_file)
        with wave.open(str(out / name), "rb") as wav_file:
            seconds = wav_file.getnframes() / float(wav_file.getframerate())
        if seconds < 0.2:
            raise RuntimeError("SilentLine")
        made.append({"id": line["id"], "file": name, "seconds": round(seconds, 3)})
    return made


def main():
    job = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = pathlib.Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    engine = job["voice"]["engine"]
    if engine == "kokoro":
        made = kokoro(job["voice"], job["lines"], out)
    elif engine == "piper":
        made = piper(job["voice"], job["lines"], out)
    else:
        raise SystemExit(f"unknown engine {engine}")
    (out / "tts.json").write_text(json.dumps(made), encoding="utf-8")
    print(f"{engine}: {len(made)} lines")


if __name__ == "__main__":
    main()
