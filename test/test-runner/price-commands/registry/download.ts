import type { PriceSelectionEntry } from '~/types'
import { exact, reportOnly } from '../helpers'

export const downloadRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts', [
    reportOnly('transcribe-url-audio', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/1-audio.mp3', '--whisper-stt', 'tiny', '--price']),
    reportOnly('transcribe-url-video', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/2-video.mp4', '--whisper-stt', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts', [
    reportOnly('transcribe-youtube-single', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=u1-WHqATSQU', '--whisper-stt', 'tiny', '--price']),
    reportOnly('transcribe-twitch', ['src/cli/create-cli.ts', 'extract', 'https://www.twitch.tv/videos/1844440442', '--whisper-stt', 'tiny', '--price']),
    reportOnly('transcribe-streaming-url-list-batch-1', ['src/cli/create-cli.ts', 'extract', 'input/examples/batch/2-urls.md', '--batch-limit', '1', '--whisper-stt', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts', [
    reportOnly('transcribe-rss-batch-1', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.substack.com/feed', '--batch-limit', '1', '--whisper-stt', 'tiny', '--price']),
    reportOnly('transcribe-youtube-channel-batch-1', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/@fireship', '--batch-limit', '1', '--whisper-stt', 'tiny', '--price']),
  ]),
]
