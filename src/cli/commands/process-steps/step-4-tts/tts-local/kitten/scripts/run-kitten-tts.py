from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

def strip_markdown(text: str) -> str:
    text = re.sub(r"```[\s\S]*?```", "", text)

    text = re.sub(r"`[^`]+`", "", text)

    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)

    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)

    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    text = re.sub(r"https?://\S+", "", text)

    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)

    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)

    text = re.sub(r"^[\s]*[-*+]\s+", "", text, flags=re.MULTILINE)

    text = re.sub(r"^[\s]*\d+\.\s+", "", text, flags=re.MULTILINE)

    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def chunk_text(text: str, max_chars: int = 450) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: list[str] = []

    for para in paragraphs:
        if len(para) <= max_chars:
            chunks.append(para)
            continue

        sentences = re.split(r"(?<=[.!?])\s+", para)
        current = ""
        for sent in sentences:
            sent = sent.strip()
            if not sent:
                continue
            if len(current) + len(sent) + 1 <= max_chars:
                current = f"{current} {sent}".strip() if current else sent
            else:
                if current:
                    chunks.append(current)
                current = sent
        if current:
            chunks.append(current)

    return [c for c in chunks if c]

def main() -> None:
    parser = argparse.ArgumentParser(description="Kitten TTS inference script")
    parser.add_argument("--model", required=True, help="HuggingFace model ID")
    parser.add_argument("--input", required=True, help="Path to input text file")
    parser.add_argument("--output", required=True, help="Path for output WAV file")
    parser.add_argument(
        "--voice", default="Jasper", help="Voice name (default: Jasper)"
    )
    parser.add_argument(
        "--max-chunk-chars", type=int, default=450, help="Max chars per TTS chunk"
    )
    args = parser.parse_args()

    raw_text = Path(args.input).read_text(encoding="utf-8").strip()
    if not raw_text:
        print(json.dumps({"error": "Input file is empty"}), file=sys.stderr)
        sys.exit(1)

    clean_text = strip_markdown(raw_text)
    chunks = chunk_text(clean_text, max_chars=args.max_chunk_chars)
    if not chunks:
        print(json.dumps({"error": "No text chunks after processing"}), file=sys.stderr)
        sys.exit(1)

    import numpy as np

    print(
        f"[kitten-tts] loading model {args.model}...",
        file=sys.stderr,
        flush=True,
    )
    from kittentts import KittenTTS

    model = KittenTTS(args.model)
    print(f"[kitten-tts] model loaded", file=sys.stderr, flush=True)

    all_wavs: list = []
    sr: int = 24000

    for i, chunk in enumerate(chunks):
        print(
            f"[kitten-tts] chunk {i + 1}/{len(chunks)}: {chunk[:60]}...",
            file=sys.stderr,
        )
        audio = model.generate(chunk, voice=args.voice)
        all_wavs.append(np.array(audio, dtype=np.float32))

    silence = np.zeros(int(sr * 0.3), dtype=np.float32)
    parts: list = []
    for idx, wav in enumerate(all_wavs):
        parts.append(wav)
        if idx < len(all_wavs) - 1:
            parts.append(silence)

    combined = np.concatenate(parts) if len(parts) > 1 else parts[0]

    import soundfile as sf

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, combined, sr)

    duration = len(combined) / sr

    print(
        json.dumps(
            {
                "sampleRate": sr,
                "chunkCount": len(chunks),
                "durationSeconds": round(duration, 2),
            }
        )
    )

if __name__ == "__main__":
    main()
