import type { PriceSelectionEntry } from '../../../../src/types/tests-dir-types'
import { command, exact, prefix } from '../helpers'

export const sttRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-default.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'base', '--price']),
    command('transcribe-whisper-split', 'transcribe-whisper-split', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--split', '--whisper', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-models-price.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'base', '--price']),
    command('transcribe-whisper-small', 'transcribe-whisper-small', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'small', '--price']),
    command('transcribe-whisper-medium', 'transcribe-whisper-medium', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'medium', '--price']),
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-large-v3-turbo.test.ts', [
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price']),
    command('transcribe-whisper-large-v3-turbo-split', 'transcribe-whisper-large-v3-turbo-split', ['src/cli/create-cli.ts', 'extract', 'input/examples/video/2-video.mp4', '--whisper', 'large-v3-turbo', '--split', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/', [
    command('transcribe-reverb', 'transcribe-reverb', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--reverb', '--reverb-verbatimicity', '0.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-services/aws/aws.test.ts', [
    command('transcribe-aws-standard', 'transcribe-aws-standard', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--aws-stt', 'standard', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-services/gcloud/gcloud.test.ts', [
    command('transcribe-gcloud-chirp_3', 'transcribe-gcloud-chirp_3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--gcloud-stt', 'chirp_3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-stt-e2e/stt-services/service-models.test.ts', [
    command('transcribe-assemblyai-universal-3-pro', 'transcribe-assemblyai-universal-3-pro', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--assemblyai-stt', 'universal-3-pro', '--price']),
    command('transcribe-deapi-WhisperLargeV3', 'transcribe-deapi-WhisperLargeV3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--deapi-stt', 'WhisperLargeV3', '--price']),
    command('transcribe-gladia-default', 'transcribe-gladia-default', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--gladia-stt', 'default', '--price']),
    command('transcribe-happyscribe-auto', 'transcribe-happyscribe-auto', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--happyscribe-stt', 'auto', '--price']),
    command('transcribe-deepgram-nova-3', 'transcribe-deepgram-nova-3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--deepgram-stt', 'nova-3', '--price']),
    command('transcribe-deepinfra-openai-whisper-large-v3', 'transcribe-deepinfra-openai-whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--deepinfra-stt', 'openai/whisper-large-v3', '--price']),
    command('transcribe-deepinfra-openai-whisper-large-v3-turbo', 'transcribe-deepinfra-openai-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--deepinfra-stt', 'openai/whisper-large-v3-turbo', '--price']),
    command('transcribe-soniox-stt-async-v4', 'transcribe-soniox-stt-async-v4', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--soniox-stt', 'stt-async-v4', '--price']),
    command('transcribe-speechmatics-standard', 'transcribe-speechmatics-standard', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--speechmatics-stt', 'standard', '--price']),
    command('transcribe-speechmatics-enhanced', 'transcribe-speechmatics-enhanced', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--speechmatics-stt', 'enhanced', '--price']),
    command('transcribe-rev-machine', 'transcribe-rev-machine', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--rev-stt', 'machine', '--price']),
    command('transcribe-rev-low_cost', 'transcribe-rev-low_cost', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--rev-stt', 'low_cost', '--price']),
    command('transcribe-elevenlabs-scribe_v2', 'transcribe-elevenlabs-scribe_v2', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--elevenlabs-stt', 'scribe_v2', '--price']),
    command('transcribe-groq-whisper-large-v3', 'transcribe-groq-whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--groq-stt', 'whisper-large-v3', '--price']),
    command('transcribe-groq-whisper-large-v3-turbo', 'transcribe-groq-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--groq-stt', 'whisper-large-v3-turbo', '--price']),
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--mistral-stt', 'voxtral-mini-2602', '--price']),
  ]),
]
