import sys

critical_modules = ["whisper", "librosa", "soundfile", "scipy", "torch", "torchaudio", "numpy"]
optional_modules = ["ctc_forced_aligner", "demucs", "pyannote.audio"]
missing_critical = []
missing_optional = []
compatibility_issues = []

for module in critical_modules:
    try:
        mod = __import__(module)
        print(f"✓ {module}")
    except ImportError as e:
        missing_critical.append(f"{module}: {e}")
        print(f"✗ {module}: {e}")

for module in optional_modules:
    try:
        mod = __import__(module)
        print(f"✓ {module}")
        
        if module == "ctc_forced_aligner":
            try:
                from ctc_forced_aligner import load_alignment_model
                print(f"  ✓ load_alignment_model function available")
            except ImportError:
                try:
                    from ctc_forced_aligner.alignment import load_model
                    print(f"  ✓ alternative load_model function available")
                except ImportError:
                    compatibility_issues.append(f"{module}: missing expected functions")
                    
    except ImportError as e:
        missing_optional.append(f"{module}: {e}")
        print(f"✗ {module}: {e}")

if missing_critical:
    print(f"\nCRITICAL ERROR: Missing required modules:")
    for missing in missing_critical:
        print(f"  - {missing}")
    sys.exit(1)
    
if missing_optional:
    print(f"\nOptional modules missing (will use fallback mode):")
    for missing in missing_optional:
        print(f"  - {missing}")
    
if compatibility_issues:
    print(f"\nCompatibility issues detected:")
    for issue in compatibility_issues:
        print(f"  - {issue}")
    print("Whisper-diarization will use fallback mode")
else:
    print("\nAll dependencies and compatibility checks passed")