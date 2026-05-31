import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'
import {
  minimaxFreeMusicCommandTimeoutMs,
  minimaxFreeMusicTestTimeoutMs,
  minimaxMusic,
} from './cases'

defineMusicServiceTest({
  ...minimaxMusic,
  models: [
    {
      model: 'music-2.6-free',
      prompt: 'an ambient piano instrumental',
      extraArgs: ['--instrumental'],
      expectedLyricsSource: 'none',
      commandTimeoutMs: minimaxFreeMusicCommandTimeoutMs,
      testTimeoutMs: minimaxFreeMusicTestTimeoutMs,
    },
  ],
  musicService: 'minimax',
})

