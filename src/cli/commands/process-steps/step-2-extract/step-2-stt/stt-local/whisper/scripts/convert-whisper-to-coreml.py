#!/usr/bin/env python3
import argparse
import torch
import torch.nn as nn
import torch.nn.functional as F
import whisper
import coremltools as ct
from pathlib import Path

class AudioEncoder(nn.Module):
    def __init__(self, whisper_model):
        super().__init__()
        self.conv1 = whisper_model.encoder.conv1
        self.conv2 = whisper_model.encoder.conv2
        self.positional_embedding = whisper_model.encoder.positional_embedding
        self.blocks = whisper_model.encoder.blocks
        self.ln_post = whisper_model.encoder.ln_post
        self.n_mels = whisper_model.dims.n_mels
        self.n_audio_ctx = whisper_model.dims.n_audio_ctx
        self.n_audio_state = whisper_model.dims.n_audio_state
        
    def forward(self, mel):
        x = F.gelu(self.conv1(mel))
        x = F.gelu(self.conv2(x))
        x = x.permute(0, 2, 1)
        
        n_ctx = x.shape[1]
        pos_emb = self.positional_embedding[:n_ctx]
        x = (x + pos_emb).to(x.dtype)
        
        for block in self.blocks:
            x = block(x)
            
        x = self.ln_post(x)
        return x

def convert_encoder_to_coreml(model_name, models_dir):
    print(f"Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name, download_root=models_dir)
    model.eval()
    
    wrapper = AudioEncoder(model)
    wrapper.eval()
    
    if model_name in ["tiny", "tiny.en", "base", "base.en"]:
        n_frames = 1500
    else:
        n_frames = 3000
    
    n_mels = model.dims.n_mels
    mel_input = torch.randn(1, n_mels, n_frames)
    
    print(f"Model input shape: {mel_input.shape}")
    print("Tracing encoder model")
    
    with torch.no_grad():
        traced = torch.jit.trace(wrapper, mel_input, check_trace=False)
    
    print("Converting to CoreML")
    coreml_model = ct.convert(
        traced,
        convert_to="mlprogram",
        inputs=[ct.TensorType(shape=mel_input.shape, name="logmel_data")],
        outputs=[ct.TensorType(name="output")],
        compute_units=ct.ComputeUnit.CPU_AND_NE,
        minimum_deployment_target=ct.target.macOS13
    )
    
    output_path = Path(models_dir) / f"coreml-encoder-{model_name}.mlpackage"
    print(f"Saving CoreML model to {output_path}")
    coreml_model.save(str(output_path))
    print("CoreML conversion complete")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--models-dir", required=True)
    args = parser.parse_args()
    
    convert_encoder_to_coreml(args.model, args.models_dir)
