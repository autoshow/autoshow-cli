import type { PriceSelectionEntry } from '~/types'
import { command, exact, prefix } from '../helpers'

export const sttRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/whisper-default.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisper=tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisper=base', '--price']),
    command('transcribe-whisper-split', 'transcribe-whisper-split', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--split', '--provider', 'whisper=tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/whisper-large-v3-turbo.test.ts', [
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisper=large-v3-turbo', '--price']),
    command('transcribe-whisper-tiny-split', 'transcribe-whisper-tiny-split', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/2-video.mp4', '--provider', 'whisper=tiny', '--split', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/reverb/', [
    command('transcribe-reverb', 'transcribe-reverb', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'reverb', '--reverb-verbatimicity', '0.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/service-models.test.ts', [
    command('transcribe-assemblyai-universal-3-pro', 'transcribe-assemblyai-universal-3-pro', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'assemblyai=universal-3-pro', '--price']),
    command('transcribe-gladia-default', 'transcribe-gladia-default', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'gladia=default', '--price']),
    command('transcribe-happyscribe-auto', 'transcribe-happyscribe-auto', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'happyscribe=auto', '--price']),
    command('transcribe-deepgram-nova-3', 'transcribe-deepgram-nova-3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepgram=nova-3', '--price']),
    command('transcribe-deepinfra-openai/whisper-large-v3', 'transcribe-deepinfra-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3', '--price']),
    command('transcribe-deepinfra-openai/whisper-large-v3-turbo', 'transcribe-deepinfra-openai/whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3-turbo', '--price']),
    command('transcribe-together-openai/whisper-large-v3', 'transcribe-together-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'together=openai/whisper-large-v3', '--price']),
    command('transcribe-soniox-stt-async-v4', 'transcribe-soniox-stt-async-v4', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'soniox=stt-async-v4', '--price']),
    command('transcribe-speechmatics-standard', 'transcribe-speechmatics-standard', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'speechmatics=standard', '--price']),
    command('transcribe-speechmatics-enhanced', 'transcribe-speechmatics-enhanced', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'speechmatics=enhanced', '--price']),
    command('transcribe-rev-machine', 'transcribe-rev-machine', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'rev=machine', '--price']),
    command('transcribe-rev-low_cost', 'transcribe-rev-low_cost', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'rev=low_cost', '--price']),
    command('transcribe-elevenlabs-scribe_v2', 'transcribe-elevenlabs-scribe_v2', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'elevenlabs=scribe_v2', '--price']),
    command('transcribe-groq-whisper-large-v3', 'transcribe-groq-whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'groq=whisper-large-v3', '--price']),
    command('transcribe-groq-whisper-large-v3-turbo', 'transcribe-groq-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'groq=whisper-large-v3-turbo', '--price']),
    command('transcribe-grok-speech-to-text', 'transcribe-grok-speech-to-text', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'grok=speech-to-text', '--price']),
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'mistral=voxtral-mini-2602', '--price']),
    command('transcribe-openai-stt-gpt-4o-mini-transcribe', 'transcribe-openai-stt-gpt-4o-mini-transcribe', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'openai=gpt-4o-mini-transcribe', '--price']),
    command('transcribe-openai-stt-gpt-4o-transcribe', 'transcribe-openai-stt-gpt-4o-transcribe', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'openai=gpt-4o-transcribe', '--price']),
    command('transcribe-gemini-stt-gemini-3-flash-preview', 'transcribe-gemini-stt-gemini-3-flash-preview', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'gemini=gemini-3-flash-preview', '--price']),
    command('transcribe-glm-stt-glm-asr-2512', 'transcribe-glm-stt-glm-asr-2512', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'glm=glm-asr-2512', '--price']),
    command('transcribe-supadata-auto', 'transcribe-supadata-auto', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--provider', 'supadata=auto', '--price']),
    command('transcribe-scrapecreators-youtube-transcript', 'transcribe-scrapecreators-youtube-transcript', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--provider', 'scrapecreators=youtube-transcript', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'whisper=tiny', '--price']),
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/lyrics/01-example-song.mp3', '--provider', 'whisper=large-v3-turbo', '--price']),
  ]),
]
