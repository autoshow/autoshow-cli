#!/usr/bin/env python3
import sys
import json

def parse_rttm(rttm_file):
    segments = []
    with open(rttm_file, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 8 and parts[0] == "SPEAKER":
                start = float(parts[3])
                duration = float(parts[4])
                end = start + duration
                speaker = parts[7]
                segments.append({
                    'start': start,
                    'end': end,
                    'speaker': speaker
                })
    return sorted(segments, key=lambda x: x['start'])

def parse_ctm(ctm_file):
    words = []
    with open(ctm_file, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                start = float(parts[2])
                duration = float(parts[3])
                word = parts[4]
                if word != "'":
                    words.append({
                        'start': start,
                        'end': start + duration,
                        'word': word
                    })
    return words

def assign_speakers(words, segments):
    for word in words:
        word_mid = (word['start'] + word['end']) / 2
        best_overlap = 0
        best_speaker = None
        
        for segment in segments:
            if segment['start'] <= word_mid <= segment['end']:
                overlap = min(word['end'], segment['end']) - max(word['start'], segment['start'])
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = segment['speaker']
        
        word['speaker'] = best_speaker if best_speaker else 'UNKNOWN'
    
    return words

def create_segments(words, max_words=100):
    segments = []
    current_segment = []
    current_speaker = None
    
    for word in words:
        if not current_segment:
            current_segment = [word]
            current_speaker = word['speaker']
        elif word['speaker'] != current_speaker or len(current_segment) >= max_words:
            segments.append({
                'start': current_segment[0]['start'],
                'end': current_segment[-1]['end'],
                'text': ' '.join([w['word'] for w in current_segment]),
                'speaker': current_speaker,
                'words': current_segment
            })
            current_segment = [word]
            current_speaker = word['speaker']
        else:
            current_segment.append(word)
    
    if current_segment:
        segments.append({
            'start': current_segment[0]['start'],
            'end': current_segment[-1]['end'],
            'text': ' '.join([w['word'] for w in current_segment]),
            'speaker': current_speaker,
            'words': current_segment
        })
    
    return segments

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: assign-words-to-speakers.py <rttm_file> <ctm_file> <output_json>", file=sys.stderr)
        sys.exit(1)
    
    rttm_file = sys.argv[1]
    ctm_file = sys.argv[2]
    output_file = sys.argv[3]
    
    try:
        diarization_segments = parse_rttm(rttm_file)
        print(f"Parsed {len(diarization_segments)} diarization segments", file=sys.stderr)
        
        words = parse_ctm(ctm_file)
        print(f"Parsed {len(words)} words from CTM", file=sys.stderr)
        
        words_with_speakers = assign_speakers(words, diarization_segments)
        
        segments = create_segments(words_with_speakers)
        
        speakers = set([s['speaker'] for s in segments if s['speaker'] != 'UNKNOWN'])
        print(f"Created {len(segments)} segments with {len(speakers)} speakers", file=sys.stderr)
        
        output = {
            'segments': segments,
            'text': ' '.join([w['word'] for w in words_with_speakers]),
            'speakers': list(speakers)
        }
        
        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"Output saved to {output_file}", file=sys.stderr)
        sys.exit(0)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)