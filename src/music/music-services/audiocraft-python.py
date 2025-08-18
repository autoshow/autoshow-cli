import sys
import json
import os
import warnings
warnings.filterwarnings("ignore")

import torch
import torchaudio
from audiocraft.models import MusicGen
from audiocraft.data.audio import audio_write

if len(sys.argv) < 2:
    print("Error: No configuration provided")
    sys.exit(1)

config = json.loads(sys.argv[1])

os.environ['AUDIOCRAFT_CACHE_DIR'] = config.get('cache_dir', 'models/audiocraft')
os.makedirs(os.environ['AUDIOCRAFT_CACHE_DIR'], exist_ok=True)

model_name = config.get('model', 'facebook/musicgen-small')
prompt = config['prompt']
output_path = config['output']
duration = config.get('duration', 8)
temperature = config.get('temperature', 1.0)
top_k = config.get('top_k', 250)
top_p = config.get('top_p', 0.0)
cfg_coef = config.get('cfg_coef', 3.0)
use_sampling = config.get('use_sampling', True)
two_step_cfg = config.get('two_step_cfg', False)
extend_stride = config.get('extend_stride', 18)

print(f"Loading model: {model_name}")
try:
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = MusicGen.get_pretrained(model_name, device=device)
    
    model.set_generation_params(
        duration=duration,
        temperature=temperature,
        top_k=top_k,
        top_p=top_p,
        cfg_coef=cfg_coef,
        use_sampling=use_sampling,
        two_step_cfg=two_step_cfg,
        extend_stride=extend_stride
    )
    
    print(f"Generating music for prompt: {prompt[:50]}...")
    
    if config.get('melody_path'):
        melody, sr = torchaudio.load(config['melody_path'])
        if sr != model.sample_rate:
            from torchaudio.transforms import Resample
            resampler = Resample(sr, model.sample_rate)
            melody = resampler(melody)
        
        wav = model.generate_with_chroma(
            [prompt],
            melody[None].to(device),
            model.sample_rate
        )
    elif config.get('continuation_path'):
        continuation, sr = torchaudio.load(config['continuation_path'])
        if sr != model.sample_rate:
            from torchaudio.transforms import Resample
            resampler = Resample(sr, model.sample_rate)
            continuation = resampler(continuation)
        
        prompt_duration = min(continuation.shape[-1] / model.sample_rate, 30)
        wav = model.generate_continuation(
            continuation[None].to(device),
            model.sample_rate,
            [prompt],
            prompt_duration=prompt_duration
        )
    else:
        wav = model.generate([prompt])
    
    output_dir = os.path.dirname(output_path)
    output_name = os.path.splitext(os.path.basename(output_path))[0]
    
    audio_write(
        f'{output_dir}/{output_name}',
        wav[0].cpu(),
        model.sample_rate,
        strategy="loudness",
        loudness_compressor=True
    )
    
    actual_output = f'{output_dir}/{output_name}.wav'
    if not os.path.exists(actual_output):
        import scipy.io.wavfile
        scipy.io.wavfile.write(output_path, model.sample_rate, wav[0].cpu().numpy().T)
        actual_output = output_path
    
    print(f"Saved to {actual_output}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)