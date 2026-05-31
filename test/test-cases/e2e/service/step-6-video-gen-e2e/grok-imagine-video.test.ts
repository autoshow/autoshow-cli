import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { grokVideo } from './cases'

defineVideoServiceTest({
  ...grokVideo,
  models: [
    { model: 'grok-imagine-video', extraArgs: ['--duration', '1', '--resolution', '480p'] },
  ],
  videoService: 'grok',
})

