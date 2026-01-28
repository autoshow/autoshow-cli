#!/usr/bin/env python3
"""
Reverb Pipeline Script for venv execution
Handles model loading with fallbacks for both local and HuggingFace models
"""

import json
import os
import sys
from typing import Any, Dict, List, Optional, Union


# Try imports with fallbacks
def import_with_fallback(module_name: str, fallback_message: str):
    try:
        return __import__(module_name)
    except ImportError as e:
        print(f"ERROR: {fallback_message}", file=sys.stderr)
        print(f"Import error: {e}", file=sys.stderr)
        raise


torch = import_with_fallback("torch", "torch not installed")
sf = import_with_fallback("soundfile", "soundfile not installed")

# Import pyannote with detailed error
try:
    from pyannote.audio import Pipeline
    from pyannote.core import Segment
except ImportError as e:
    print(f"ERROR: pyannote.audio not installed: {e}", file=sys.stderr)
    print("Try: pip install pyannote.audio", file=sys.stderr)
    raise

# Import wenet with detailed error
try:
    import wenet
except ImportError as e:
    print(f"ERROR: wenet not installed: {e}", file=sys.stderr)
    print("The wenet module comes from the reverb package.", file=sys.stderr)
    print(
        "Try: pip install git+https://github.com/revdotcom/reverb.git", file=sys.stderr
    )
    raise


def resolve_model_path(model_name: str, model_type: str = "asr") -> str:
    """
    Resolve model path with fallback chain:
    1. Local build/models path
    2. Environment variable path
    3. Model name for auto-download
    """
    # Check for local models in build directory
    local_paths = [
        f"build/models/{model_name}",
        f"build/models/reverb-{model_type}",
    ]
    for path in local_paths:
        if os.path.exists(path) and os.path.isdir(path):
            config_file = os.path.join(path, "config.yaml")
            if os.path.exists(config_file):
                abs_path = os.path.abspath(path)
                print(f"Using local model: {abs_path}", file=sys.stderr)
                return abs_path

    # Check environment variable
    env_var = f"REVERB_{model_type.upper()}_MODEL_PATH"
    env_path = os.environ.get(env_var)
    if env_path and os.path.exists(env_path):
        print(f"Using model from {env_var}: {env_path}", file=sys.stderr)
        return env_path

    # Fall back to model name (triggers auto-download)
    print(
        f"Model not found locally, will attempt download: {model_name}", file=sys.stderr
    )
    return model_name


def resolve_diarization_model(model_input: str, hf_token: str) -> str:
    """
    Resolve diarization model with fallback chain:
    1. Local build/models path
    2. Environment variable
    3. HuggingFace model ID (for Pipeline.from_pretrained)
    """
    # Normalize input
    if model_input in ("v1", "reverb-diarization-v1"):
        model_id = "reverb-diarization-v1"
        hf_model = "Revai/reverb-diarization-v1"
    elif model_input in ("v2", "reverb-diarization-v2"):
        model_id = "reverb-diarization-v2"
        hf_model = "Revai/reverb-diarization-v2"
    else:
        model_id = model_input
        hf_model = model_input if "/" in model_input else f"Revai/{model_input}"

    # Check for local models
    local_path = f"build/models/{model_id}"
    if os.path.exists(local_path) and os.path.isdir(local_path):
        abs_path = os.path.abspath(local_path)
        print(f"Using local diarization model: {abs_path}", file=sys.stderr)
        return abs_path

    # Check environment variable
    env_var = f"REVERB_DIARIZATION_{model_input.upper().replace('-', '_')}_PATH"
    env_path = os.environ.get(env_var)
    if env_path and os.path.exists(env_path):
        print(f"Using diarization model from env: {env_path}", file=sys.stderr)
        return env_path

    # Fall back to HuggingFace model ID
    print(f"Using HuggingFace diarization model: {hf_model}", file=sys.stderr)
    return hf_model


def parse_ctm_output(ctm_output: Any) -> List[Dict[str, Any]]:
    """Parse CTM output from wenet into word list with timestamps."""
    words: List[Dict[str, Any]] = []

    if isinstance(ctm_output, str):
        for line in ctm_output.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 5:
                continue
            try:
                start = float(parts[2])
                duration = float(parts[3])
                word = parts[4]
            except (ValueError, IndexError):
                continue
            end = start + duration
            words.append({"word": word, "start": start, "end": end})
        return words

    if isinstance(ctm_output, list):
        for item in ctm_output:
            if not isinstance(item, dict):
                continue
            word = item.get("word") or item.get("text") or item.get("token")
            start = (
                item.get("start") if item.get("start") is not None else item.get("from")
            )
            end = item.get("end") if item.get("end") is not None else item.get("to")
            if word is None or start is None:
                continue
            try:
                start_val = float(start)
                end_val = float(end) if end is not None else start_val
            except ValueError:
                continue
            words.append({"word": str(word), "start": start_val, "end": end_val})
        return words

    return words


def resolve_speaker_label(word: Dict[str, Any], diarization) -> str:
    """Determine which speaker spoke a given word based on diarization."""
    start = float(word.get("start", 0.0))
    end = float(word.get("end", start))
    if end <= start:
        end = start + 0.01

    segment = Segment(start, end)
    cropped = diarization.crop(segment, mode="intersection")
    labels = cropped.labels()
    if not labels:
        return "UNKNOWN"

    best_label = None
    best_duration = 0.0
    for label in labels:
        duration = cropped.label_duration(label)
        if duration > best_duration:
            best_duration = duration
            best_label = label

    return best_label or labels[0]


def format_speaker_transcript(words: List[Dict[str, Any]], diarization) -> str:
    """Format words with speaker labels into transcript."""
    if not words:
        return ""

    label_to_speaker: Dict[str, int] = {}
    next_speaker = 0

    def speaker_id(label: str) -> int:
        nonlocal next_speaker
        if label not in label_to_speaker:
            label_to_speaker[label] = next_speaker
            next_speaker += 1
        return label_to_speaker[label]

    transcript_lines: List[str] = []
    current_label: Optional[str] = None
    current_words: List[str] = []

    for word in words:
        label = resolve_speaker_label(word, diarization)
        if current_label is None:
            current_label = label

        if label != current_label and current_words:
            speaker = speaker_id(current_label)
            transcript_lines.append(f"Speaker {speaker}: {' '.join(current_words)}")
            current_words = []
            current_label = label

        current_words.append(word["word"])

    if current_words and current_label is not None:
        speaker = speaker_id(current_label)
        transcript_lines.append(f"Speaker {speaker}: {' '.join(current_words)}")

    return "\n\n".join(transcript_lines)


def load_audio_for_diarization(audio_path: str) -> Union[Dict[str, Any], str]:
    """
    Load audio file and return dict format for pyannote.
    This avoids torchcodec/FFmpeg issues by preloading audio.
    """
    try:
        waveform_np, sample_rate = sf.read(audio_path, always_2d=True)
        waveform = torch.from_numpy(waveform_np).transpose(0, 1).float()
        return {"waveform": waveform, "sample_rate": sample_rate}
    except Exception as e:
        print(f"WARNING: Failed to preload audio with soundfile: {e}", file=sys.stderr)
        print(
            "Falling back to file path (may require torchcodec/FFmpeg)", file=sys.stderr
        )
        return audio_path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python reverb_pipeline.py '<json_payload>'", file=sys.stderr)
        print(
            "Payload: {audioPath, asrModel, diarizationModel, hfToken}", file=sys.stderr
        )
        raise SystemExit(1)

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON payload: {e}", file=sys.stderr)
        raise SystemExit(1)

    audio_path = payload.get("audioPath")
    asr_model = payload.get("asrModel", "reverb_asr_v1")
    diarization_model = payload.get("diarizationModel", "reverb-diarization-v2")
    hf_token = payload.get("hfToken")

    if not audio_path:
        print("ERROR: audioPath is required", file=sys.stderr)
        raise SystemExit(1)

    if not os.path.exists(audio_path):
        print(f"ERROR: Audio file not found: {audio_path}", file=sys.stderr)
        raise SystemExit(1)

    if not hf_token:
        print("ERROR: hfToken is required for diarization models", file=sys.stderr)
        raise SystemExit(1)

    # Resolve model paths with fallbacks
    asr_model_path = resolve_model_path(asr_model, "asr")
    diarization_model_path = resolve_diarization_model(diarization_model, hf_token)

    # Load ASR model
    print(f"Loading ASR model: {asr_model_path}", file=sys.stderr)
    try:
        reverb = wenet.load_model(asr_model_path)
    except Exception as e:
        print(f"ERROR: Failed to load ASR model: {e}", file=sys.stderr)
        print("Attempting fallback to model name for auto-download...", file=sys.stderr)
        try:
            reverb = wenet.load_model("reverb_asr_v1")
        except Exception as e2:
            print(f"ERROR: Fallback also failed: {e2}", file=sys.stderr)
            raise SystemExit(1)

    # Run ASR
    print(f"Transcribing: {audio_path}", file=sys.stderr)
    try:
        ctm_output = reverb.transcribe(audio_path, format="ctm")
    except Exception as e:
        print(f"ERROR: Transcription failed: {e}", file=sys.stderr)
        raise SystemExit(1)

    words = parse_ctm_output(ctm_output)
    print(f"Transcribed {len(words)} words", file=sys.stderr)

    # Load audio for diarization (preload to avoid torchcodec issues)
    audio_input = load_audio_for_diarization(audio_path)

    # Load diarization pipeline
    print(f"Loading diarization model: {diarization_model_path}", file=sys.stderr)
    try:
        pipeline = Pipeline.from_pretrained(
            diarization_model_path, use_auth_token=hf_token
        )
    except Exception as e:
        print(f"ERROR: Failed to load diarization model: {e}", file=sys.stderr)
        print("Attempting fallback to HuggingFace model...", file=sys.stderr)
        try:
            fallback_model = "Revai/reverb-diarization-v2"
            pipeline = Pipeline.from_pretrained(fallback_model, use_auth_token=hf_token)
        except Exception as e2:
            print(f"ERROR: Fallback also failed: {e2}", file=sys.stderr)
            raise SystemExit(1)

    # Run diarization
    print("Running diarization...", file=sys.stderr)
    try:
        diarization = pipeline(audio_input)
    except Exception as e:
        print(f"ERROR: Diarization failed: {e}", file=sys.stderr)
        # Try with file path as fallback
        if isinstance(audio_input, dict):
            print("Attempting fallback with file path...", file=sys.stderr)
            try:
                diarization = pipeline(audio_path)
            except Exception as e2:
                print(f"ERROR: Fallback also failed: {e2}", file=sys.stderr)
                raise SystemExit(1)
        else:
            raise SystemExit(1)

    # Format output
    transcript = format_speaker_transcript(words, diarization)

    output = {
        "transcript": transcript,
        "wordCount": len(words),
    }

    # Write JSON to stdout (only stdout, all logs go to stderr)
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()
