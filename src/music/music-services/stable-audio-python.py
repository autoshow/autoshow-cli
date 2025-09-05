import sys
import json
import os
import warnings
warnings.filterwarnings("ignore")

import torch
import torchaudio
from stable_audio_tools import get_pretrained_model
from stable_audio_tools.inference.generation import generate_diffusion_cond

if len(sys.argv) < 2:
    print("Error: No configuration provided")
    sys.exit(1)

config = json.loads(sys.argv[1])

os.environ['HF_HOME'] = config.get('cache_dir', 'models/stable-audio')
os.makedirs(os.environ['HF_HOME'], exist_ok=True)

model_name = config.get('model', 'stabilityai/stable-audio-open-1.0')
prompt = config['prompt']
output_path = config['output']
duration = config.get('duration', 8)
steps = config.get('steps', 100)
cfg_scale = config.get('cfg_scale', 7.0)
sigma_min = config.get('sigma_min', 0.3)
sigma_max = config.get('sigma_max', 500)
sampler_type = config.get('sampler_type', 'dpmpp-3m-sde')
seed = config.get('seed', None)
batch_size = config.get('batch_size', 1)

print(f"Loading model: {model_name}")
try:
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    model, model_config = get_pretrained_model(model_name)
    sample_rate = model_config["sample_rate"]
    sample_size = model_config["sample_size"]
    
    model = model.to(device)
    
    if seed is not None:
        torch.manual_seed(seed)
    
    conditioning = [{
        "prompt": prompt,
        "seconds_start": 0, 
        "seconds_total": duration
    }]
    
    print(f"Generating music for prompt: {prompt[:50]}...")
    print(f"Duration: {duration}s, Steps: {steps}, CFG Scale: {cfg_scale}")
    
    output = generate_diffusion_cond(
        model,
        steps=steps,
        cfg_scale=cfg_scale,
        conditioning=conditioning,
        sample_size=int(duration * sample_rate),
        sigma_min=sigma_min,
        sigma_max=sigma_max,
        sampler_type=sampler_type,
        device=device,
        batch_size=batch_size
    )
    
    output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).mul(32767).to(torch.int16).cpu()
    
    if output.dim() == 3:
        output = output.squeeze(0)
    
    if output.dim() == 1:
        output = output.unsqueeze(0)
    
    torchaudio.save(output_path, output, sample_rate)
    
    print(f"Saved to {output_path}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)