import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { minimaxVideo } from './cases'

defineVideoServiceTest({
  ...minimaxVideo,
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--duration', '6'], expectedDuration: 6 },
  ],
  videoService: 'minimax',
})

