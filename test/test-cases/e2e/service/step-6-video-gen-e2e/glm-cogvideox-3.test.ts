import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { glmVideo } from './cases'

defineVideoServiceTest({
  ...glmVideo,
  models: [
    { model: 'cogvideox-3', extraArgs: ['--duration', '5'], expectedDuration: 5 },
  ],
  videoService: 'glm',
})

