import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { geminiVideo } from './cases'

defineVideoServiceTest({
  ...geminiVideo,
  models: [
    { model: 'veo-3.1-generate-preview', extraArgs: ['--duration', '4'], expectedDuration: 4 },
  ],
  videoService: 'gemini',
})

