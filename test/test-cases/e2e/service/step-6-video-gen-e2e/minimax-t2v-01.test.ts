import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { minimaxVideo } from './cases'

defineVideoServiceTest({
  ...minimaxVideo,
  models: [
    { model: 'T2V-01', extraArgs: ['--duration', '6'], expectedDuration: 6 },
  ],
  videoService: 'minimax',
})

