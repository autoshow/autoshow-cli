import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { glmVideo } from './cases'

defineVideoServiceTest({
  ...glmVideo,
  models: [
    { model: 'viduq1-text', extraArgs: ['--duration', '5'], expectedDuration: 5 },
  ],
  videoService: 'glm',
})

