import torch
import sys
import json
import warnings

warnings.filterwarnings("ignore", category=UserWarning, module="jieba._compat")

from TTS.api import TTS

if len(sys.argv) < 2:
    print("Error: No configuration provided")
    sys.exit(1)

config = json.loads(sys.argv[1])
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {device}, Loading: {config['model']}")

tts = TTS(config['model']).to(device)

is_xtts = 'xtts' in config['model']
has_speaker_wav = 'speaker_wav' in config and config['speaker_wav']
has_speaker = 'speaker' in config and config['speaker']

if is_xtts and has_speaker_wav:
    print("Generating with voice cloning...")
    tts.tts_to_file(
        text=config['text'],
        speaker_wav=config['speaker_wav'],
        language=config.get('language', 'en'),
        file_path=config['output'],
        split_sentences=True
    )
elif has_speaker:
    print(f"Using speaker: {config['speaker']}")
    tts.tts_to_file(
        text=config['text'],
        speaker=config['speaker'],
        file_path=config['output']
    )
else:
    tts.tts_to_file(
        text=config['text'],
        file_path=config['output']
    )

print(f"Saved to {config['output']}")