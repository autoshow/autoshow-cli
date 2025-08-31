#!/usr/bin/env python3
import os
import sys
import argparse
import traceback
import subprocess
import tempfile
import re

def check_dependencies():
    """Check for required dependencies and their compatibility"""
    missing = []
    compatibility_issues = []
    
    try:
        import whisper
    except ImportError:
        missing.append("whisper")
    
    try:
        import librosa
    except ImportError:
        missing.append("librosa")
    
    try:
        import ctc_forced_aligner
        try:
            from ctc_forced_aligner import load_alignment_model
        except ImportError:
            try:
                from ctc_forced_aligner.alignment import load_model as load_alignment_model
            except ImportError:
                compatibility_issues.append("ctc_forced_aligner: missing expected functions")
    except ImportError:
        missing.append("ctc_forced_aligner")
        
    try:
        import demucs
    except ImportError:
        missing.append("demucs")
        
    try:
        import pyannote.audio
    except ImportError:
        missing.append("pyannote.audio")
    
    if missing:
        print(f"Error: Missing required dependencies: {', '.join(missing)}", file=sys.stderr)
        return False, compatibility_issues
    
    return True, compatibility_issues

def is_technical_output(line):
    """Check if a line contains technical output that should be filtered out"""
    line = line.strip()
    if not line:
        return True
    
    # Progress bars and percentages
    if re.search(r'\d+%\|[█▏▎▍▌▋▊▉]+\|', line):
        return True
    if re.search(r'\d+%\|.*\|\s*\d+\.\d+[GM]iB/s', line):
        return True
    if re.search(r'\d+/\d+\s*\[\d+:\d+<\d+:\d+.*frames/s\]', line):
        return True
    
    # Download/transfer information
    if 'iB/s' in line or 'frames/s' in line:
        return True
    if re.search(r'\d+\.\d+[GM]iB', line):
        return True
    
    # Warning messages
    if line.startswith('Warning:') or 'UserWarning:' in line:
        return True
    if 'deprecated' in line.lower() or 'FP16 is not supported' in line:
        return True
    if 'torchaudio._backend' in line or 'set_audio_backend' in line:
        return True
    
    # Technical status messages
    if line.startswith('Using fallback whisper-only transcription'):
        return True
    if line.startswith('Diarization unavailable'):
        return True
    if line.startswith('Reason:'):
        return True
    if 'Traceback (most recent call last):' in line:
        return True
    
    # Empty lines or just whitespace
    if not line.strip():
        return True
    
    return False

def is_transcript_line(line):
    """Check if a line looks like an actual transcript line"""
    line = line.strip()
    if not line:
        return False
    
    # Look for timestamp patterns like [00:00] or [MM:SS]
    if re.match(r'^\[\d{2}:\d{2}\]', line):
        return True
    
    # Look for speaker patterns
    if re.match(r'^Speaker \d+:', line):
        return True
    
    # Look for combined timestamp and speaker patterns
    if re.match(r'^\[\d{2}:\d{2}\]\s*Speaker \d+:', line):
        return True
    
    return False

def filter_transcript_output(output):
    """Filter the output to keep only transcript content"""
    lines = output.split('\n')
    transcript_lines = []
    
    for line in lines:
        # Skip technical output
        if is_technical_output(line):
            continue
        
        # Keep transcript lines
        if is_transcript_line(line):
            transcript_lines.append(line.strip())
        # Also keep lines that might be continuation of transcript content
        elif line.strip() and not any(skip in line.lower() for skip in ['error:', 'warning:', 'traceback']):
            # Check if this looks like plain transcript text following a speaker line
            if transcript_lines and not line.strip().startswith('['):
                transcript_lines.append(line.strip())
    
    return '\n'.join(transcript_lines) if transcript_lines else ''

def create_whisper_fallback_transcript(audio_path, model_name):
    """Create a basic transcript using just whisper with simple speaker labels"""
    try:
        import whisper
        
        print(f"Using fallback whisper-only transcription with model: {model_name}", file=sys.stderr)
        
        # Suppress warnings during model loading and transcription
        import warnings
        warnings.filterwarnings("ignore")
        
        model = whisper.load_model(model_name)
        result = model.transcribe(audio_path, verbose=False)
        
        if 'segments' in result and result['segments']:
            transcript_lines = []
            current_speaker = 1
            last_speaker_change = 0
            
            for i, segment in enumerate(result['segments']):
                start_time = int(segment['start'])
                minutes = start_time // 60
                seconds = start_time % 60
                timestamp = f"{minutes:02d}:{seconds:02d}"
                text = segment['text'].strip()
                
                # Simple speaker alternation based on pauses
                if start_time - last_speaker_change > 10:  # 10 second threshold
                    current_speaker = 2 if current_speaker == 1 else 1
                    last_speaker_change = start_time
                
                if text:
                    transcript_lines.append(f"[{timestamp}] Speaker {current_speaker}: {text}")
            
            if transcript_lines:
                return '\n'.join(transcript_lines)
        
        # Fallback to simple format
        text = result.get('text', 'Transcription failed').strip()
        return f"[00:00] Speaker 1: {text}" if text else "[00:00] Speaker 1: No transcription available"
        
    except Exception as e:
        print(f"Whisper fallback failed: {e}", file=sys.stderr)
        return f"[00:00] Speaker 1: Transcription error: {str(e)}"

def try_original_diarization(args):
    """Attempt to run the original diarization script"""
    try:
        original_script = os.path.join(os.path.dirname(__file__), 'whisper-diarize-original.py')
        if not os.path.exists(original_script):
            return False, "Original diarization script not found"
        
        # Run the original script and capture output
        cmd = [sys.executable, original_script] + sys.argv[1:]
        
        # Create environment that suppresses warnings
        env = os.environ.copy()
        env['PYTHONWARNINGS'] = 'ignore'
        
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            timeout=300,  # 5 minute timeout
            cwd=os.path.dirname(original_script),
            env=env
        )
        
        if result.returncode == 0:
            # Filter the output to remove technical messages
            filtered_output = filter_transcript_output(result.stdout)
            
            if filtered_output.strip():
                print(filtered_output)
                return True, None
        
        # If we get here, either the return code was non-zero or no valid transcript was found
        error_msg = result.stderr.strip() if result.stderr else "No valid transcript output from diarization"
        return False, error_msg
        
    except subprocess.TimeoutExpired:
        return False, "Diarization timed out after 5 minutes"
    except Exception as e:
        return False, f"Error running diarization: {str(e)}"

def main():
    parser = argparse.ArgumentParser(description='Whisper Diarization with Compatibility Layer')
    parser.add_argument('-a', '--audio', required=True, help='Audio file path')
    parser.add_argument('--whisper-model', default='medium.en', help='Whisper model')
    parser.add_argument('--device', default='cpu', help='Device to use')
    parser.add_argument('--no-stem', action='store_true', help='Disable source separation')
    
    args = parser.parse_args()
    
    # Validate audio file exists
    if not os.path.exists(args.audio):
        print(f"Error: Audio file not found: {args.audio}", file=sys.stderr)
        sys.exit(1)
    
    # Check dependencies
    deps_ok, compatibility_issues = check_dependencies()
    if not deps_ok:
        sys.exit(1)
    
    # Try original diarization first
    success, error_msg = try_original_diarization(args)
    
    if success:
        return
    
    # If we have compatibility issues or diarization failed, use fallback
    if compatibility_issues or error_msg:
        print(f"Diarization unavailable, using whisper-only fallback", file=sys.stderr)
        if error_msg:
            print(f"Reason: {error_msg}", file=sys.stderr)
    
    # Fallback to basic whisper transcription
    transcript = create_whisper_fallback_transcript(args.audio, args.whisper_model)
    print(transcript)

if __name__ == "__main__":
    main()