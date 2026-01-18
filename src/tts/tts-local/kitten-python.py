import sys
import json
import warnings
warnings.filterwarnings("ignore")

from kittentts import KittenTTS
import soundfile as sf
import numpy as np

MAX_CHUNK_SIZE = 500

def chunk_text(text, max_size=MAX_CHUNK_SIZE):
    sentences = text.replace('!', '.').replace('?', '.').split('.')
    sentences = [s.strip() for s in sentences if s.strip()]
    
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(sentence) > max_size:
            words = sentence.split()
            temp_chunk = ""
            for word in words:
                if len(temp_chunk) + len(word) + 1 <= max_size:
                    temp_chunk = temp_chunk + " " + word if temp_chunk else word
                else:
                    if temp_chunk:
                        chunks.append(temp_chunk + ".")
                    temp_chunk = word
            if temp_chunk:
                chunks.append(temp_chunk + ".")
        elif len(current_chunk) + len(sentence) + 2 <= max_size:
            current_chunk = current_chunk + " " + sentence + "." if current_chunk else sentence + "."
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = sentence + "."
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

if len(sys.argv) < 2:
    print("Error: No configuration provided")
    sys.exit(1)

config = json.loads(sys.argv[1])
text = config['text']
print(f"Loading model: {config['model']}, Voice: {config['voice']}, Text length: {len(text)}")

try:
    tts = KittenTTS(config['model'])
    
    if len(text) > MAX_CHUNK_SIZE:
        print(f"Text too long ({len(text)} chars), splitting into chunks...")
        chunks = chunk_text(text)
        print(f"Created {len(chunks)} chunks")
        
        audio_chunks = []
        for i, chunk in enumerate(chunks):
            print(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
            chunk_audio = tts.generate(chunk, voice=config['voice'])
            audio_chunks.append(chunk_audio)
            
            silence_duration = int(0.2 * 24000)
            silence = np.zeros(silence_duration, dtype=chunk_audio.dtype)
            audio_chunks.append(silence)
        
        audio = np.concatenate(audio_chunks[:-1])
        print(f"Combined {len(chunks)} audio chunks")
    else:
        audio = tts.generate(text, voice=config['voice'])
    
    sample_rate = 24000
    if config.get('speed', 1.0) != 1.0:
        import numpy as np
        speed_factor = config['speed']
        indices = np.round(np.arange(0, len(audio), speed_factor)).astype(int)
        indices = indices[indices < len(audio)]
        audio = audio[indices]
        print(f"Applied speed adjustment: {speed_factor}x")
    
    sf.write(config['output'], audio, sample_rate)
    print(f"Saved to {config['output']}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)