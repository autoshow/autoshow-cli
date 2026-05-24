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
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/assemblyai-universal-3-pro.test.ts', [
    command('transcribe-assemblyai-universal-3-pro', 'transcribe-assemblyai-universal-3-pro', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'assemblyai=universal-3-pro', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/gladia-default.test.ts', [
    command('transcribe-gladia-default', 'transcribe-gladia-default', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'gladia=default', '--price']),
    command('transcribe-happyscribe-auto', 'transcribe-happyscribe-auto', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'happyscribe=auto', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepgram-nova-3.test.ts', [
    command('transcribe-deepgram-nova-3', 'transcribe-deepgram-nova-3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepgram=nova-3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3.test.ts', [
    command('transcribe-deepinfra-openai/whisper-large-v3', 'transcribe-deepinfra-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3-turbo.test.ts', [
    command('transcribe-deepinfra-openai/whisper-large-v3-turbo', 'transcribe-deepinfra-openai/whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/together-openai-whisper-large-v3.test.ts', [
    command('transcribe-together-openai/whisper-large-v3', 'transcribe-together-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'together=openai/whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/soniox-stt-async-v4.test.ts', [
    command('transcribe-soniox-stt-async-v4', 'transcribe-soniox-stt-async-v4', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'soniox=stt-async-v4', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/speechmatics-standard.test.ts', [
    command('transcribe-speechmatics-standard', 'transcribe-speechmatics-standard', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'speechmatics=standard', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/speechmatics-enhanced.test.ts', [
    command('transcribe-speechmatics-enhanced', 'transcribe-speechmatics-enhanced', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'speechmatics=enhanced', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/rev-machine.test.ts', [
    command('transcribe-rev-machine', 'transcribe-rev-machine', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'rev=machine', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/rev-low-cost.test.ts', [
    command('transcribe-rev-low_cost', 'transcribe-rev-low_cost', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'rev=low_cost', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/elevenlabs-scribe-v2.test.ts', [
    command('transcribe-elevenlabs-scribe_v2', 'transcribe-elevenlabs-scribe_v2', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'elevenlabs=scribe_v2', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/elevenlabs-scribe-v2-speaker-count.test.ts', [
    command('transcribe-elevenlabs-scribe_v2', 'transcribe-elevenlabs-scribe_v2', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'elevenlabs=scribe_v2', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/groq-whisper-large-v3.test.ts', [
    command('transcribe-groq-whisper-large-v3', 'transcribe-groq-whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'groq=whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/groq-whisper-large-v3-turbo.test.ts', [
    command('transcribe-groq-whisper-large-v3-turbo', 'transcribe-groq-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'groq=whisper-large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/grok-speech-to-text.test.ts', [
    command('transcribe-grok-speech-to-text', 'transcribe-grok-speech-to-text', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'grok=speech-to-text', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/mistral-voxtral-mini-2602.test.ts', [
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'mistral=voxtral-mini-2602', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/openai-gpt-4o-mini-transcribe.test.ts', [
    command('transcribe-openai-stt-gpt-4o-mini-transcribe', 'transcribe-openai-stt-gpt-4o-mini-transcribe', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'openai=gpt-4o-mini-transcribe', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/openai-gpt-4o-transcribe.test.ts', [
    command('transcribe-openai-stt-gpt-4o-transcribe', 'transcribe-openai-stt-gpt-4o-transcribe', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'openai=gpt-4o-transcribe', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/gemini-3-flash-preview.test.ts', [
    command('transcribe-gemini-stt-gemini-3-flash-preview', 'transcribe-gemini-stt-gemini-3-flash-preview', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'gemini=gemini-3-flash-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/glm-asr-2512.test.ts', [
    command('transcribe-glm-stt-glm-asr-2512', 'transcribe-glm-stt-glm-asr-2512', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'glm=glm-asr-2512', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/supadata-auto-url-transcript.test.ts', [
    command('transcribe-supadata-auto', 'transcribe-supadata-auto', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--provider', 'supadata=auto', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/scrapecreators-youtube-transcript.test.ts', [
    command('transcribe-scrapecreators-youtube-transcript', 'transcribe-scrapecreators-youtube-transcript', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--provider', 'scrapecreators=youtube-transcript', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'whisper=tiny', '--price']),
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/lyrics/01-example-song.mp3', '--provider', 'whisper=large-v3-turbo', '--price']),
  ]),
]
