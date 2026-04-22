https://docs.mistral.ai/admin/user-management-finops/tier
https://docs.mistral.ai/admin/user-management-finops/usage-limits
https://docs.mistral.ai/resources/known-limitations#vision
https://docs.mistral.ai/studio-api/audio/speech_to_text
https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription
https://docs.mistral.ai/models/model-cards/voxtral-mini-transcribe-26-02
https://docs.mistral.ai/studio-api/batch-processing

On the Offline Transcription page (https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription) it says this

What's the maximum audio length?
The maximum length will depend on the endpoint used, currently the limits are as follows:

Chat with Audio: ≈20 minutes for Voxtral Mini Transcribe and Voxtral Small.
Transcription: ≈15 minutes for Voxtral Mini Transcribe and Voxtral Small, and ≈3 hours for Voxtral Mini Transcribe 2.

On the Audio & Transcription page (https://docs.mistral.ai/studio-api/audio/speech_to_text) it says this

Voxtral Mini Transcribe V2
Voxtral Mini Transcribe V2 is designed for batch transcription. It provides:

High accuracy: Industry-leading transcription quality with low word error rates.
Speaker diarization: Automatically identifies and labels different speakers in your audio.
Context biasing: Allows you to guide the model with custom vocabulary for accurate transcription of domain-specific terms.
Word-Level timestamps: Provides precise timestamps for each word, useful for subtitle generation and audio search.
Multilingual support: Supports transcription in 13 languages, including English, Chinese, Hindi, Spanish, Arabic, French, Portuguese, Russian, German, Japanese, Korean, Italian, and Dutch.
Noise robustness: Maintains high accuracy in challenging acoustic environments.
Long audio support: Processes recordings up to 3 hours in a single request.

On the Known limitations page (https://docs.mistral.ai/resources/known-limitations) it says this

Audio transcription
Copy section link
Audio transcription
Supported formats: WAV, MP3, FLAC, OGG, WEBM.
Maximum audio duration: 60 minutes.
Maximum file size: 500 MB.
Transcription is optimized for clear speech; heavy background noise reduces accuracy.