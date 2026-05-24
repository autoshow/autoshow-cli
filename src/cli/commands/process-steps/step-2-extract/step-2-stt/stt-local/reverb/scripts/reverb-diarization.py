#!/usr/bin/env python3
import inspect
import os
import sys
import tempfile

try:
    import yaml
except ImportError:
    yaml = None


def patch_huggingface_auth_compatibility():
    try:
        import huggingface_hub
        import huggingface_hub.file_download as file_download
    except Exception:
        return

    def wrap_hf_hub_download(original):
        try:
            parameters = inspect.signature(original).parameters
        except (TypeError, ValueError):
            return original

        if "use_auth_token" in parameters or "token" not in parameters:
            return original

        def compatible_hf_hub_download(*args, **kwargs):
            if "use_auth_token" in kwargs:
                if "token" not in kwargs:
                    kwargs["token"] = kwargs["use_auth_token"]
                del kwargs["use_auth_token"]
            return original(*args, **kwargs)

        return compatible_hf_hub_download

    for module in (huggingface_hub, file_download):
        original = getattr(module, "hf_hub_download", None)
        if original is not None:
            setattr(module, "hf_hub_download", wrap_hf_hub_download(original))


patch_huggingface_auth_compatibility()

from pyannote.audio import Pipeline
import torch
import torchaudio


def normalize_pipeline_model_name(model_name):
    if os.path.isdir(model_name):
        return os.path.join(model_name, "config.yaml")
    return model_name


def rewrite_local_pipeline_config(model_name):
    config_path = normalize_pipeline_model_name(model_name)
    if not os.path.isfile(config_path) or os.path.basename(config_path) != "config.yaml":
        return config_path, None

    if yaml is None:
        print(
            "[DIARIZATION] PyYAML is unavailable; using local config without rewrite",
            file=sys.stderr,
        )
        return config_path, None

    try:
        with open(config_path, "r", encoding="utf-8") as config_file:
            config = yaml.safe_load(config_file)
    except Exception as error:
        print(
            f"[DIARIZATION] Could not read local pipeline config: {error}",
            file=sys.stderr,
        )
        return config_path, None

    if not isinstance(config, dict):
        return config_path, None

    pipeline_config = config.get("pipeline")
    if not isinstance(pipeline_config, dict):
        return config_path, None

    params = pipeline_config.get("params")
    if not isinstance(params, dict):
        return config_path, None

    config_dir = os.path.dirname(os.path.abspath(config_path))
    reverb_models_dir = os.path.dirname(config_dir)
    segmentation_checkpoint = os.path.join(config_dir, "pytorch_model.bin")
    embedding_checkpoint = os.path.join(
        reverb_models_dir,
        "pyannote-wespeaker-voxceleb-resnet34-LM",
        "pytorch_model.bin",
    )

    rewritten = False
    if os.path.isfile(segmentation_checkpoint):
        params["segmentation"] = segmentation_checkpoint
        rewritten = True
        print(
            f"[DIARIZATION] Using local segmentation checkpoint: {segmentation_checkpoint}",
            file=sys.stderr,
        )

    if os.path.isfile(embedding_checkpoint):
        params["embedding"] = embedding_checkpoint
        rewritten = True
        print(
            f"[DIARIZATION] Using local embedding checkpoint: {embedding_checkpoint}",
            file=sys.stderr,
        )

    if not rewritten:
        return config_path, None

    temp_config = tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".yaml",
        prefix="autoshow-reverb-diarization-",
        delete=False,
        encoding="utf-8",
    )
    try:
        with temp_config:
            yaml.safe_dump(config, temp_config, sort_keys=False)
    except Exception:
        os.unlink(temp_config.name)
        raise

    return temp_config.name, temp_config.name


def pipeline_auth_kwargs(hf_token):
    if not hf_token:
        return {}

    try:
        parameters = inspect.signature(Pipeline.from_pretrained).parameters
    except (TypeError, ValueError):
        return {"use_auth_token": hf_token}

    if "token" in parameters:
        return {"token": hf_token}
    if "use_auth_token" in parameters:
        return {"use_auth_token": hf_token}
    return {}


def load_diarization_pipeline(model_name, hf_token):
    load_target, temp_config_path = rewrite_local_pipeline_config(model_name)
    try:
        return Pipeline.from_pretrained(load_target, **pipeline_auth_kwargs(hf_token))
    finally:
        if temp_config_path:
            try:
                os.unlink(temp_config_path)
            except OSError:
                pass


def run_diarization(audio_path, hf_token, model_name="Revai/reverb-diarization-v2"):
    try:
        print(f"[DIARIZATION] Loading diarization model: {model_name}", file=sys.stderr)

        pipeline = load_diarization_pipeline(model_name, hf_token)

        if pipeline is None:
            print(
                f"[DIARIZATION ERROR] Failed to load pipeline from {model_name}",
                file=sys.stderr,
            )
            return 1

        print(f"[DIARIZATION] Pipeline loaded successfully", file=sys.stderr)
        print(f"[DIARIZATION] Pipeline type: {type(pipeline)}", file=sys.stderr)
        print(
            f"[DIARIZATION] Pipeline class: {pipeline.__class__.__name__}",
            file=sys.stderr,
        )

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[DIARIZATION] Using device: {device}", file=sys.stderr)

        if hasattr(pipeline, "to"):
            pipeline = pipeline.to(device)
            print(f"[DIARIZATION] Pipeline moved to device", file=sys.stderr)
        elif hasattr(pipeline, "_segmentation") and hasattr(
            pipeline._segmentation, "model"
        ):
            if hasattr(pipeline._segmentation.model, "to"):
                pipeline._segmentation.model = pipeline._segmentation.model.to(device)
                print(
                    f"[DIARIZATION] Segmentation model moved to device", file=sys.stderr
                )
        elif hasattr(pipeline, "segmentation") and hasattr(
            pipeline.segmentation, "model"
        ):
            if hasattr(pipeline.segmentation.model, "to"):
                pipeline.segmentation.model = pipeline.segmentation.model.to(device)
                print(
                    f"[DIARIZATION] Segmentation model moved to device", file=sys.stderr
                )

        print(f"[DIARIZATION] Loading audio file: {audio_path}", file=sys.stderr)
        waveform, sample_rate = torchaudio.load(audio_path)

        print(
            f"[DIARIZATION] Audio loaded: sample_rate={sample_rate}, shape={waveform.shape}",
            file=sys.stderr,
        )
        print(
            f"[DIARIZATION] Audio duration: {waveform.shape[1] / sample_rate:.2f} seconds",
            file=sys.stderr,
        )

        audio_dict = {"waveform": waveform, "sample_rate": sample_rate}

        print(f"[DIARIZATION] Running diarization pipeline", file=sys.stderr)

        diarization = pipeline(audio_dict)

        if diarization is None:
            print(
                "[DIARIZATION ERROR] Diarization returned no results", file=sys.stderr
            )
            return 1

        print(f"[DIARIZATION] Diarization completed", file=sys.stderr)
        print(f"[DIARIZATION] Output type: {type(diarization)}", file=sys.stderr)
        print(
            f"[DIARIZATION] Output class: {diarization.__class__.__name__}",
            file=sys.stderr,
        )

        if hasattr(diarization, "__dict__"):
            print(
                f"[DIARIZATION] Output attributes: {list(diarization.__dict__.keys())}",
                file=sys.stderr,
            )

        rttm_lines = []
        speakers_seen = set()

        annotation = None

        if hasattr(diarization, "speaker_diarization"):
            print(f"[DIARIZATION] Using speaker_diarization attribute", file=sys.stderr)
            annotation = diarization.speaker_diarization
            print(f"[DIARIZATION] Annotation type: {type(annotation)}", file=sys.stderr)
        elif hasattr(diarization, "annotation"):
            print(f"[DIARIZATION] Using annotation attribute", file=sys.stderr)
            annotation = diarization.annotation
            print(f"[DIARIZATION] Annotation type: {type(annotation)}", file=sys.stderr)
        elif hasattr(diarization, "segments"):
            print(f"[DIARIZATION] Using segments attribute", file=sys.stderr)
            annotation = diarization.segments
            print(f"[DIARIZATION] Segments type: {type(annotation)}", file=sys.stderr)
        else:
            print(f"[DIARIZATION] Using diarization object directly", file=sys.stderr)
            annotation = diarization

        if annotation is None:
            print("[DIARIZATION ERROR] Could not find annotation data", file=sys.stderr)
            return 1

        print(
            f"[DIARIZATION] Annotation object type: {type(annotation)}", file=sys.stderr
        )
        print(f"[DIARIZATION] Checking for itertracks method", file=sys.stderr)

        if hasattr(annotation, "itertracks"):
            print(f"[DIARIZATION] Using itertracks method", file=sys.stderr)
            track_count = 0
            for segment, track, speaker in annotation.itertracks(yield_label=True):
                speakers_seen.add(speaker)
                rttm_line = f"SPEAKER {os.path.basename(audio_path)} 1 {segment.start:.3f} {segment.duration:.3f} <NA> <NA> {speaker} <NA> <NA>"
                rttm_lines.append(rttm_line)
                track_count += 1
                if track_count % 10 == 0:
                    print(
                        f"[DIARIZATION] Processed {track_count} segments",
                        file=sys.stderr,
                    )

            print(
                f"[DIARIZATION] Total segments processed: {track_count}",
                file=sys.stderr,
            )
        else:
            print(
                f"[DIARIZATION] No itertracks method, trying direct iteration",
                file=sys.stderr,
            )
            try:
                segment_count = 0
                for item in annotation:
                    print(f"[DIARIZATION] Item type: {type(item)}", file=sys.stderr)
                    if hasattr(item, "__len__") and len(item) >= 3:
                        segment, track, speaker = item[0], item[1], item[2]
                    else:
                        segment, track, speaker = item

                    speakers_seen.add(speaker)
                    rttm_line = f"SPEAKER {os.path.basename(audio_path)} 1 {segment.start:.3f} {segment.duration:.3f} <NA> <NA> {speaker} <NA> <NA>"
                    rttm_lines.append(rttm_line)
                    segment_count += 1

                print(
                    f"[DIARIZATION] Total segments processed: {segment_count}",
                    file=sys.stderr,
                )
            except TypeError as e:
                print(
                    f"[DIARIZATION ERROR] Cannot iterate annotation: {e}",
                    file=sys.stderr,
                )
                print(
                    f"[DIARIZATION] Annotation dir: {dir(annotation)}", file=sys.stderr
                )
                return 1

        if len(rttm_lines) == 0:
            print("[DIARIZATION ERROR] No RTTM lines generated", file=sys.stderr)
            return 1

        speaker_count = len(speakers_seen)
        print(
            f"[DIARIZATION] Diarization complete: {len(rttm_lines)} segments, {speaker_count} speakers",
            file=sys.stderr,
        )
        print(
            f"[DIARIZATION] Speakers identified: {sorted(speakers_seen)}",
            file=sys.stderr,
        )

        print("\n".join(rttm_lines))
        return 0

    except ImportError as e:
        print(f"[DIARIZATION ERROR] Import error: {e}", file=sys.stderr)
        print(
            "[DIARIZATION ERROR] Please ensure pyannote.audio and torchaudio are installed",
            file=sys.stderr,
        )
        return 1
    except RuntimeError as e:
        if "CUDA" in str(e):
            print(
                f"[DIARIZATION ERROR] CUDA error, falling back to CPU: {e}",
                file=sys.stderr,
            )
            try:
                pipeline = load_diarization_pipeline(model_name, hf_token)
                device = torch.device("cpu")

                if hasattr(pipeline, "to"):
                    pipeline = pipeline.to(device)

                waveform, sample_rate = torchaudio.load(audio_path)
                audio_dict = {"waveform": waveform, "sample_rate": sample_rate}

                diarization = pipeline(audio_dict)

                rttm_lines = []
                annotation = (
                    diarization.speaker_diarization
                    if hasattr(diarization, "speaker_diarization")
                    else diarization
                )

                if hasattr(annotation, "itertracks"):
                    for segment, track, speaker in annotation.itertracks(
                        yield_label=True
                    ):
                        rttm_line = f"SPEAKER {os.path.basename(audio_path)} 1 {segment.start:.3f} {segment.duration:.3f} <NA> <NA> {speaker} <NA> <NA>"
                        rttm_lines.append(rttm_line)

                print("\n".join(rttm_lines))
                print(
                    f"[DIARIZATION] Diarization complete with CPU: {len(rttm_lines)} segments",
                    file=sys.stderr,
                )
                return 0
            except Exception as cpu_e:
                print(
                    f"[DIARIZATION ERROR] CPU fallback also failed: {cpu_e}",
                    file=sys.stderr,
                )
                return 1
        else:
            print(f"[DIARIZATION ERROR] Runtime error: {e}", file=sys.stderr)
            return 1
    except Exception as e:
        print(f"[DIARIZATION ERROR] Diarization failed: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            "Usage: reverb-diarization.py <audio_path> <hf_token> [model_name]",
            file=sys.stderr,
        )
        sys.exit(1)

    audio_path = sys.argv[1]
    hf_token = sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "Revai/reverb-diarization-v2"

    sys.exit(run_diarization(audio_path, hf_token, model_name))
