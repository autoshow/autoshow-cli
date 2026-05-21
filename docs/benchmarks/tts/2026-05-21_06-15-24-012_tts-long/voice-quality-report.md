# TTS Voice Quality Report

## Summary

- Input text: `metadata.input` (535 characters, 89 words)
- Total providers: 19 (4 local, 15 cloud)
- Mode: full
- Human speech score: 55% naturalnessScore + 45% speechQualityScore
- Manual human quality overrides were added after this voice-quality report was generated; the current consensus ranking uses the updated `voice-quality-report.json` and `provider-comparison-report.*`.
- Naturalness score target weights: 45% UTMOSv2 MOS, 25% NISQA-TTS naturalness MOS, 20% paid audio-judge rubric, 10% prosody heuristics
- Speech quality score target weights: 35% NISQA quality MOS, 25% DNSMOS, 25% roundtrip STT intelligibility, 15% signal hygiene

## Method

- Audio files are normalized to temporary 16 kHz mono WAV for scoring. Original files are not modified.
- Silence threshold is computed adaptively from the audio noise floor.
- MOS-style 1-5 metrics are converted with `(mos - 1) / 4 * 100`.
- Missing components are omitted from that score's denominator and listed per provider.
- Cost, provider processing speed, and provider latency are not included in human-speech scoring.
- Full mode treats attempted paid scoring failures as fatal when credentials are configured.
- Local mode never starts paid STT or audio-judge calls.
- Confidence: High (>80% coverage), Medium (40-80%), Low (<40%). Low-coverage scores are preliminary.

## Overall Ranking

| Rank | Provider | Group | Human / 100 | Naturalness | Speech Quality | Confidence | Nat/Qual Coverage | Missing Metrics |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | `kitten/kitten-tts-mini` | local | 92.72 | 90.00 | 96.05 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 2 | `kitten/kitten-tts-nano-0.8-int8` | local | 92.69 | 90.00 | 95.98 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 3 | `openai/gpt-4o-mini-tts` | cloud | 91.38 | 87.05 | 96.68 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 4 | `gemini/gemini-3.1-flash-tts-preview` | cloud | 91.00 | 86.00 | 97.10 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 5 | `speechify/simba-english` | cloud | 90.88 | 89.29 | 92.82 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 6 | `kitten/kitten-tts-nano` | local | 90.78 | 89.29 | 92.60 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 7 | `hume/octave-2` | cloud | 90.15 | 87.76 | 93.08 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 8 | `cartesia/sonic-3.5` | cloud | 90.15 | 88.41 | 92.27 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 9 | `gcloud/chirp3-hd` | cloud | 90.10 | 85.20 | 96.10 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 10 | `elevenlabs/eleven_v3` | cloud | 89.95 | 84.76 | 96.30 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 11 | `kitten/kitten-tts-micro` | local | 89.85 | 90.00 | 89.68 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 12 | `gcloud/studio` | cloud | 89.38 | 85.00 | 94.72 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 13 | `grok/grok-tts` | cloud | 89.26 | 84.08 | 95.59 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 14 | `deepgram/aura-2-thalia-en` | cloud | 87.99 | 82.74 | 94.41 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 15 | `minimax/speech-2.8-turbo` | cloud | 87.89 | 84.31 | 92.27 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 16 | `cartesia/sonic-3` | cloud | 87.58 | 84.34 | 91.53 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 17 | `minimax/speech-2.8-hd` | cloud | 87.34 | 80.96 | 95.13 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 18 | `speechify/simba-multilingual` | cloud | 85.26 | 77.86 | 94.30 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 19 | `groq/canopylabs/orpheus-v1-english` | cloud | 77.73 | 66.40 | 91.58 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |

## Best By Group

- Best local model: `kitten/kitten-tts-mini` (92.72/100)
- Best cloud service: `openai/gpt-4o-mini-tts` (91.38/100)

## Recommendations

- **Best overall**: `kitten/kitten-tts-mini` (92.72/100)
- **Best local**: `kitten/kitten-tts-mini` (92.72/100)
- **Best cloud**: `openai/gpt-4o-mini-tts` (91.38/100)
- 19 provider(s) have low score coverage. Full mode already ran; remaining low coverage usually means external MOS/DNS metrics are missing (`utmosv2Mos`, `nisqaTtsNaturalnessMos`, `nisqaQualityMos`, `dnsmosMos`). Supply `--tts-metric-fixtures` from external scorers for higher confidence.

## Provider Details

### 1. `kitten/kitten-tts-mini` (local)

| Metric | Score |
| --- | ---: |
| Human Speech | 92.72 |
| Naturalness | 90.00 |
| Speech Quality | 96.05 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 100.00 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 96.07 | 25% | median-roundtrip-wer |
| signalHygiene | 96.03 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 33.70s
- Peak: -1.8 dBFS, RMS: -19.8 dBFS
- Clipping: 0.000%, Silence: 24.1%
- Loudness range: 10.8 dB
- Pauses: 6 (median 0.38s)

**Prosody Metrics**

- Speaking rate: 158 WPM
- Characters/sec: 15.9
- Detected pauses: 6 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 4.49% |
| openai-stt/gpt-4o-transcribe | 3.37% |
| **Median** | **3.93%** |

---

### 2. `kitten/kitten-tts-nano-0.8-int8` (local)

| Metric | Score |
| --- | ---: |
| Human Speech | 92.69 |
| Naturalness | 90.00 |
| Speech Quality | 95.98 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 100.00 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 96.07 | 25% | median-roundtrip-wer |
| signalHygiene | 95.84 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 38.98s
- Peak: -2.4 dBFS, RMS: -19.9 dBFS
- Clipping: 0.000%, Silence: 26.5%
- Loudness range: 18.3 dB
- Pauses: 6 (median 0.34s)

**Prosody Metrics**

- Speaking rate: 137 WPM
- Characters/sec: 13.7
- Detected pauses: 6 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 6.74% |
| openai-stt/gpt-4o-transcribe | 1.12% |
| **Median** | **3.93%** |

---

### 3. `openai/gpt-4o-mini-tts` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 91.38 |
| Naturalness | 87.05 |
| Speech Quality | 96.68 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 91.14 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 96.07 | 25% | median-roundtrip-wer |
| signalHygiene | 97.71 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 35.55s
- Peak: -2.6 dBFS, RMS: -19.6 dBFS
- Clipping: 0.000%, Silence: 30.3%
- Loudness range: 20.5 dB
- Pauses: 17 (median 0.34s)

**Prosody Metrics**

- Speaking rate: 150 WPM
- Characters/sec: 15.0
- Detected pauses: 17 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 3.37% |
| openai-stt/gpt-4o-transcribe | 4.49% |
| **Median** | **3.93%** |

---

### 4. `gemini/gemini-3.1-flash-tts-preview` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 91.00 |
| Naturalness | 86.00 |
| Speech Quality | 97.10 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 88.01 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 95.51 | 25% | median-roundtrip-wer |
| signalHygiene | 99.77 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 39.16s
- Peak: -1.5 dBFS, RMS: -17.1 dBFS
- Clipping: 0.000%, Silence: 32.0%
- Loudness range: 18.3 dB
- Pauses: 18 (median 0.24s)

**Prosody Metrics**

- Speaking rate: 136 WPM
- Characters/sec: 13.7
- Detected pauses: 18 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 4.49% |
| openai-stt/gpt-4o-transcribe | 4.49% |
| **Median** | **4.49%** |

---

### 5. `speechify/simba-english` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 90.88 |
| Naturalness | 89.29 |
| Speech Quality | 92.82 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 97.86 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 90.45 | 25% | median-roundtrip-wer |
| signalHygiene | 96.77 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 35.57s
- Peak: -0.1 dBFS, RMS: -17.1 dBFS
- Clipping: 0.000%, Silence: 9.3%
- Loudness range: 17.8 dB
- Pauses: 3 (median 0.28s)

**Prosody Metrics**

- Speaking rate: 150 WPM
- Characters/sec: 15.0
- Detected pauses: 3 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 14.61% |
| openai-stt/gpt-4o-transcribe | 4.49% |
| **Median** | **9.55%** |

---

### 6. `kitten/kitten-tts-nano` (local)

| Metric | Score |
| --- | ---: |
| Human Speech | 90.78 |
| Naturalness | 89.29 |
| Speech Quality | 92.60 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 97.86 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 91.01 | 25% | median-roundtrip-wer |
| signalHygiene | 95.25 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 38.98s
- Peak: -0.4 dBFS, RMS: -18.6 dBFS
- Clipping: 0.000%, Silence: 24.5%
- Loudness range: 17.7 dB
- Pauses: 3 (median 0.73s)

**Prosody Metrics**

- Speaking rate: 137 WPM
- Characters/sec: 13.7
- Detected pauses: 3 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 6.74% |
| openai-stt/gpt-4o-transcribe | 11.24% |
| **Median** | **8.99%** |

---

### 7. `hume/octave-2` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 90.15 |
| Naturalness | 87.76 |
| Speech Quality | 93.08 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 93.27 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 92.70 | 25% | median-roundtrip-wer |
| signalHygiene | 93.72 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 37.32s
- Peak: -0.3 dBFS, RMS: -16.7 dBFS
- Clipping: 0.000%, Silence: 26.7%
- Loudness range: 14.8 dB
- Pauses: 17 (median 0.29s)

**Prosody Metrics**

- Speaking rate: 143 WPM
- Characters/sec: 14.3
- Detected pauses: 17 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 8.99% |
| openai-stt/gpt-4o-transcribe | 5.62% |
| **Median** | **7.30%** |

**Warnings**

- Abrupt waveform discontinuities detected

---

### 8. `cartesia/sonic-3.5` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 90.15 |
| Naturalness | 88.41 |
| Speech Quality | 92.27 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 95.24 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 87.64 | 25% | median-roundtrip-wer |
| signalHygiene | 100.00 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 32.15s
- Peak: -5.3 dBFS, RMS: -22.2 dBFS
- Clipping: 0.000%, Silence: 33.1%
- Loudness range: 19.1 dB
- Pauses: 6 (median 0.36s)

**Prosody Metrics**

- Speaking rate: 166 WPM
- Characters/sec: 16.6
- Detected pauses: 6 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 12.36% |
| openai-stt/gpt-4o-transcribe | 12.36% |
| **Median** | **12.36%** |

---

### 9. `gcloud/chirp3-hd` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 90.10 |
| Naturalness | 85.20 |
| Speech Quality | 96.10 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 85.61 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 94.38 | 25% | median-roundtrip-wer |
| signalHygiene | 98.95 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 33.44s
- Peak: -0.1 dBFS, RMS: -19.4 dBFS
- Clipping: 0.000%, Silence: 14.9%
- Loudness range: 24.9 dB
- Pauses: 1 (median 0.22s)

**Prosody Metrics**

- Speaking rate: 160 WPM
- Characters/sec: 16.0
- Detected pauses: 1 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 7.87% |
| openai-stt/gpt-4o-transcribe | 3.37% |
| **Median** | **5.62%** |

---

### 10. `elevenlabs/eleven_v3` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 89.95 |
| Naturalness | 84.76 |
| Speech Quality | 96.30 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 84.28 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 94.38 | 25% | median-roundtrip-wer |
| signalHygiene | 99.49 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 40.32s
- Peak: -1.1 dBFS, RMS: -18.0 dBFS
- Clipping: 0.000%, Silence: 32.7%
- Loudness range: 21.3 dB
- Pauses: 20 (median 0.26s)

**Prosody Metrics**

- Speaking rate: 132 WPM
- Characters/sec: 13.3
- Detected pauses: 20 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 7.87% |
| openai-stt/gpt-4o-transcribe | 3.37% |
| **Median** | **5.62%** |

---

### 11. `kitten/kitten-tts-micro` (local)

| Metric | Score |
| --- | ---: |
| Human Speech | 89.85 |
| Naturalness | 90.00 |
| Speech Quality | 89.68 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 100.00 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 85.96 | 25% | median-roundtrip-wer |
| signalHygiene | 95.88 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 36.70s
- Peak: -1.1 dBFS, RMS: -18.5 dBFS
- Clipping: 0.000%, Silence: 27.7%
- Loudness range: 14.0 dB
- Pauses: 5 (median 0.46s)

**Prosody Metrics**

- Speaking rate: 146 WPM
- Characters/sec: 14.6
- Detected pauses: 5 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 8.99% |
| openai-stt/gpt-4o-transcribe | 19.10% |
| **Median** | **14.04%** |

---

### 12. `gcloud/studio` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 89.38 |
| Naturalness | 85.00 |
| Speech Quality | 94.72 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 85.00 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 91.57 | 25% | median-roundtrip-wer |
| signalHygiene | 99.97 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 31.85s
- Peak: -1.6 dBFS, RMS: -18.8 dBFS
- Clipping: 0.000%, Silence: 13.9%
- Loudness range: 15.2 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 168 WPM
- Characters/sec: 16.8
- Detected pauses: 0 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 11.24% |
| openai-stt/gpt-4o-transcribe | 5.62% |
| **Median** | **8.43%** |

---

### 13. `grok/grok-tts` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 89.26 |
| Naturalness | 84.08 |
| Speech Quality | 95.59 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 82.23 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 95.51 | 25% | median-roundtrip-wer |
| signalHygiene | 95.73 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 37.73s
- Peak: -3.8 dBFS, RMS: -22.9 dBFS
- Clipping: 0.000%, Silence: 41.4%
- Loudness range: 22.1 dB
- Pauses: 16 (median 0.27s)

**Prosody Metrics**

- Speaking rate: 142 WPM
- Characters/sec: 14.2
- Detected pauses: 16 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 6.74% |
| openai-stt/gpt-4o-transcribe | 2.25% |
| **Median** | **4.49%** |

---

### 14. `deepgram/aura-2-thalia-en` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 87.99 |
| Naturalness | 82.74 |
| Speech Quality | 94.41 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 78.21 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 93.26 | 25% | median-roundtrip-wer |
| signalHygiene | 96.32 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 38.18s
- Peak: -3.3 dBFS, RMS: -26.3 dBFS
- Clipping: 0.000%, Silence: 14.3%
- Loudness range: 27.4 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 140 WPM
- Characters/sec: 14.0
- Detected pauses: 0 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 6.74% |
| openai-stt/gpt-4o-transcribe | 6.74% |
| **Median** | **6.74%** |

---

### 15. `minimax/speech-2.8-turbo` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 87.89 |
| Naturalness | 84.31 |
| Speech Quality | 92.27 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 82.92 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 87.64 | 25% | median-roundtrip-wer |
| signalHygiene | 100.00 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 43.09s
- Peak: -1.3 dBFS, RMS: -17.8 dBFS
- Clipping: 0.000%, Silence: 29.4%
- Loudness range: 21.6 dB
- Pauses: 23 (median 0.31s)

**Prosody Metrics**

- Speaking rate: 124 WPM
- Characters/sec: 12.4
- Detected pauses: 23 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 1.12% |
| openai-stt/gpt-4o-transcribe | 23.60% |
| **Median** | **12.36%** |

---

### 16. `cartesia/sonic-3` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 87.58 |
| Naturalness | 84.34 |
| Speech Quality | 91.53 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 83.03 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 87.64 | 25% | median-roundtrip-wer |
| signalHygiene | 98.02 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 31.49s
- Peak: -4.1 dBFS, RMS: -22.0 dBFS
- Clipping: 0.000%, Silence: 37.9%
- Loudness range: 22.8 dB
- Pauses: 17 (median 0.39s)

**Prosody Metrics**

- Speaking rate: 170 WPM
- Characters/sec: 17.0
- Detected pauses: 17 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 15.73% |
| openai-stt/gpt-4o-transcribe | 8.99% |
| **Median** | **12.36%** |

---

### 17. `minimax/speech-2.8-hd` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 87.34 |
| Naturalness | 80.96 |
| Speech Quality | 95.13 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 72.88 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 98.31 | 25% | median-roundtrip-wer |
| signalHygiene | 89.81 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 41.65s
- Peak: -0.4 dBFS, RMS: -15.0 dBFS
- Clipping: 0.000%, Silence: 29.5%
- Loudness range: 31.0 dB
- Pauses: 22 (median 0.36s)

**Prosody Metrics**

- Speaking rate: 128 WPM
- Characters/sec: 12.8
- Detected pauses: 22 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 1.12% |
| openai-stt/gpt-4o-transcribe | 2.25% |
| **Median** | **1.69%** |

---

### 18. `speechify/simba-multilingual` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 85.26 |
| Naturalness | 77.86 |
| Speech Quality | 94.30 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 70.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 93.57 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 94.94 | 25% | median-roundtrip-wer |
| signalHygiene | 93.22 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 31.49s
- Peak: -0.0 dBFS, RMS: -16.4 dBFS
- Clipping: 0.000%, Silence: 11.6%
- Loudness range: 7.8 dB
- Pauses: 2 (median 0.20s)

**Prosody Metrics**

- Speaking rate: 170 WPM
- Characters/sec: 17.0
- Detected pauses: 2 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 6.74% |
| openai-stt/gpt-4o-transcribe | 3.37% |
| **Median** | **5.06%** |

**Warnings**

- Abrupt waveform discontinuities detected

---

### 19. `groq/canopylabs/orpheus-v1-english` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 77.73 |
| Naturalness | 66.40 |
| Speech Quality | 91.58 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 70.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 59.21 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 97.19 | 25% | median-roundtrip-wer |
| signalHygiene | 82.22 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 48.56s
- Peak: -1.3 dBFS, RMS: -21.5 dBFS
- Clipping: 0.000%, Silence: 32.4%
- Loudness range: 39.4 dB
- Pauses: 20 (median 0.44s)

**Prosody Metrics**

- Speaking rate: 110 WPM
- Characters/sec: 11.0
- Detected pauses: 20 (expected ~7)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 3.37% |
| openai-stt/gpt-4o-transcribe | 2.25% |
| **Median** | **2.81%** |


## Warnings

- speechify/simba-multilingual: Abrupt waveform discontinuities detected
- hume/octave-2: Abrupt waveform discontinuities detected
