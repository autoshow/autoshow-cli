#!/usr/bin/env python3
import sys
import json
import os
import warnings
import gc
import traceback
warnings.filterwarnings("ignore")
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'

def generate_video_hunyuan(config):
    try:
        import torch
        import numpy as np
        from pathlib import Path
        
        model_path = Path(config["model_path"])
        prompt = config["prompt"]
        output_path = config["output_path"]
        height = config.get("height", 720)
        width = config.get("width", 1280)
        num_frames = config.get("num_frames", 129)
        guidance_scale = config.get("guidance_scale", 6.0)
        negative_prompt = config.get("negative_prompt", "")
        num_inference_steps = config.get("num_inference_steps", 50)
        flow_shift = config.get("flow_shift", 7.0)
        seed = config.get("seed", None)
        use_fp8 = config.get("use_fp8", False)
        use_cpu_offload = config.get("use_cpu_offload", True)
        
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        
        if device == "mps":
            dtype = torch.float32
        elif device == "cuda" and use_fp8:
            dtype = torch.float8_e4m3fn
        else:
            dtype = torch.float16 if device == "cuda" else torch.float32
        
        print(f"Generating video: {width}x{height}, {num_frames} frames", file=sys.stderr)
        print(f"Device: {device}, dtype: {dtype}", file=sys.stderr)
        
        transformer_path = model_path / "transformers" / "mp_rank_00_model_states.pt"
        if use_fp8:
            transformer_path = model_path / "transformers" / "mp_rank_00_model_states_fp8.pt"
        
        if not transformer_path.exists():
            error_msg = f"Model weights not found at {transformer_path}. Run: bash .github/setup/video/models.sh"
            print(error_msg, file=sys.stderr)
            print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)
        
        vae_path = model_path / "vae"
        if not vae_path.exists():
            error_msg = f"VAE model not found at {vae_path}. Run: bash .github/setup/video/models.sh"
            print(error_msg, file=sys.stderr)
            print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)
        
        text_encoder_path = model_path / "text_encoder"
        if not text_encoder_path.exists():
            error_msg = f"Text encoder not found at {text_encoder_path}. Run: bash .github/setup/video/models.sh"
            print(error_msg, file=sys.stderr)
            print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)
        
        try:
            from diffusers import HunyuanVideoPipeline
            from diffusers.models import HunyuanVideoTransformer3DModel, AutoencoderKLHunyuanVideo
            from diffusers.schedulers import FlowMatchEulerDiscreteScheduler
            from transformers import LlamaModel, LlamaTokenizer
            
            print("Loading HunyuanVideo pipeline components", file=sys.stderr)
            
            print("Loading VAE", file=sys.stderr)
            vae = AutoencoderKLHunyuanVideo.from_pretrained(
                str(vae_path),
                torch_dtype=dtype
            )
            
            print("Loading text encoder", file=sys.stderr)
            text_encoder = LlamaModel.from_pretrained(
                str(text_encoder_path),
                torch_dtype=dtype
            )
            
            tokenizer = LlamaTokenizer.from_pretrained(
                str(text_encoder_path)
            )
            
            print("Loading transformer (this may take a while)", file=sys.stderr)
            transformer = HunyuanVideoTransformer3DModel.from_pretrained(
                str(model_path / "transformers"),
                torch_dtype=dtype,
                subfolder=""
            )
            
            scheduler = FlowMatchEulerDiscreteScheduler(
                shift=flow_shift,
                reverse=True,
                solver="euler"
            )
            
            print("Creating pipeline", file=sys.stderr)
            pipe = HunyuanVideoPipeline(
                vae=vae,
                text_encoder=text_encoder,
                tokenizer=tokenizer,
                transformer=transformer,
                scheduler=scheduler
            )
            
            if use_cpu_offload and device == "cuda":
                pipe.enable_model_cpu_offload()
            elif device == "mps":
                pipe = pipe.to(device)
                pipe.enable_attention_slicing()
            else:
                pipe = pipe.to(device)
            
            if seed is not None:
                generator = torch.Generator(device=device).manual_seed(seed) if device != "mps" else None
            else:
                generator = None
            
            print(f"Generating video with prompt: {prompt}", file=sys.stderr)
            with torch.no_grad():
                output = pipe(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    height=height,
                    width=width,
                    num_frames=num_frames,
                    guidance_scale=guidance_scale,
                    num_inference_steps=num_inference_steps,
                    generator=generator
                ).frames[0]
            
            import imageio
            imageio.mimwrite(output_path, output, fps=24, codec='libx264')
            
            print(json.dumps({"success": True, "path": output_path}))
            
        except ImportError as e:
            error_msg = f"Missing required dependencies: {str(e)}. Ensure diffusers>=0.31.0 is installed."
            print(error_msg, file=sys.stderr)
            print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)
            
        except Exception as e:
            error_msg = f"Pipeline error: {str(e)}"
            print(error_msg, file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)
            print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)
                
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        if 'device' in locals() and device == "cuda":
            torch.cuda.empty_cache()
        gc.collect()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No config provided"}))
        sys.exit(1)
    
    config = json.loads(sys.argv[1])
    generate_video_hunyuan(config)