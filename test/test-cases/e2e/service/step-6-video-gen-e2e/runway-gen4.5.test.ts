import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { runwayVideo } from './cases'

defineVideoServiceTest({
  ...runwayVideo,
  models: [
    { model: 'gen4.5', extraArgs: ['--duration', '5'], expectedDuration: 5, prompt: 'A serene mountain landscape at sunrise with mist rolling through the valleys' },
  ],
  videoService: 'runway',
})

