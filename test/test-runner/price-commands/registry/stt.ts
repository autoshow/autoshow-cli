import type { PriceSelectionEntry } from '~/types'
import { command, exact, prefix } from '../helpers'

export const sttRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-default.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--whisper', 'tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--whisper', 'base', '--price']),
    command('transcribe-whisper-split', 'transcribe-whisper-split', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--split', '--whisper', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-large-v3-turbo.test.ts', [
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price']),
    command('transcribe-whisper-tiny-split', 'transcribe-whisper-tiny-split', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/2-video.mp4', '--whisper', 'tiny', '--split', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/', [
    command('transcribe-reverb', 'transcribe-reverb', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--reverb', '--reverb-verbatimicity', '0.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-services/aws/aws.test.ts', [
    command('transcribe-aws-standard', 'transcribe-aws-standard', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--aws', 'standard', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-services/gcloud/gcloud.test.ts', [
    command('transcribe-gcloud-chirp_3', 'transcribe-gcloud-chirp_3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--gcloud', 'chirp_3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-services/service-models.test.ts', [
    command('transcribe-assemblyai-universal-3-pro', 'transcribe-assemblyai-universal-3-pro', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--assemblyai', 'universal-3-pro', '--price']),
    command('transcribe-deapi-WhisperLargeV3', 'transcribe-deapi-WhisperLargeV3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--deapi', 'WhisperLargeV3', '--price']),
    command('transcribe-gladia-default', 'transcribe-gladia-default', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--gladia', 'default', '--price']),
    command('transcribe-happyscribe-auto', 'transcribe-happyscribe-auto', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--happyscribe', 'auto', '--price']),
    command('transcribe-deepgram-nova-3', 'transcribe-deepgram-nova-3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--deepgram', 'nova-3', '--price']),
    command('transcribe-deepinfra-openai/whisper-large-v3', 'transcribe-deepinfra-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--deepinfra', 'openai/whisper-large-v3', '--price']),
    command('transcribe-deepinfra-openai/whisper-large-v3-turbo', 'transcribe-deepinfra-openai/whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--deepinfra', 'openai/whisper-large-v3-turbo', '--price']),
    command('transcribe-together-openai/whisper-large-v3', 'transcribe-together-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--together', 'openai/whisper-large-v3', '--price']),
    command('transcribe-soniox-stt-async-v4', 'transcribe-soniox-stt-async-v4', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--soniox', 'stt-async-v4', '--price']),
    command('transcribe-speechmatics-standard', 'transcribe-speechmatics-standard', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--speechmatics', 'standard', '--price']),
    command('transcribe-speechmatics-enhanced', 'transcribe-speechmatics-enhanced', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--speechmatics', 'enhanced', '--price']),
    command('transcribe-rev-machine', 'transcribe-rev-machine', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--rev', 'machine', '--price']),
    command('transcribe-rev-low_cost', 'transcribe-rev-low_cost', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--rev', 'low_cost', '--price']),
    command('transcribe-elevenlabs-scribe_v2', 'transcribe-elevenlabs-scribe_v2', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--elevenlabs', 'scribe_v2', '--price']),
    command('transcribe-groq-whisper-large-v3', 'transcribe-groq-whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--groq', 'whisper-large-v3', '--price']),
    command('transcribe-groq-whisper-large-v3-turbo', 'transcribe-groq-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--groq', 'whisper-large-v3-turbo', '--price']),
    command('transcribe-grok-speech-to-text', 'transcribe-grok-speech-to-text', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--grok', 'speech-to-text', '--price']),
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--mistral', 'voxtral-mini-2602', '--price']),
    command('transcribe-openai-stt-gpt-4o-mini-transcribe', 'transcribe-openai-stt-gpt-4o-mini-transcribe', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--openai', 'gpt-4o-mini-transcribe', '--price']),
    command('transcribe-openai-stt-gpt-4o-transcribe', 'transcribe-openai-stt-gpt-4o-transcribe', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--openai', 'gpt-4o-transcribe', '--price']),
    command('transcribe-gemini-stt-gemini-3-flash-preview', 'transcribe-gemini-stt-gemini-3-flash-preview', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--gemini', 'gemini-3-flash-preview', '--price']),
    command('transcribe-glm-stt-glm-asr-2512', 'transcribe-glm-stt-glm-asr-2512', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--glm', 'glm-asr-2512', '--price']),
    command('transcribe-supadata-auto', 'transcribe-supadata-auto', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--supadata', 'auto', '--price']),
    command('transcribe-scrapecreators-youtube-transcript', 'transcribe-scrapecreators-youtube-transcript', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--scrapecreators', 'youtube-transcript', '--price']),
  ]),
  ...exact('test/test-cases/e2e/cli-integration.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--whisper', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--whisper', 'tiny', '--price']),
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/lyrics/01-example-song.mp3', '--whisper', 'large-v3-turbo', '--price']),
  ]),
]
