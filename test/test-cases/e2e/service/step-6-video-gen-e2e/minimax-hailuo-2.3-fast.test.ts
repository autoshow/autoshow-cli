import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { minimaxVideo } from './cases'

defineVideoServiceTest({
  ...minimaxVideo,
  models: [
    { model: 'MiniMax-Hailuo-2.3-Fast', extraArgs: ['--mode', 'image-to-video', '--input-image', 'input/examples/document/1-document.jpg', '--duration', '6'], expectedDuration: 6 },
  ],
  videoService: 'minimax',
})

