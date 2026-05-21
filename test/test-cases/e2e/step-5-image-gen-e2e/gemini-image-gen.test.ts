import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  models: [
    { model: 'gemini-3.1-flash-image-preview', prompt: 'a tiny purple circle on white background', extraArgs: ['--image-size', '1K', '--image-aspect-ratio', '1:1'] },
  ],
  cliFlag: '--gemini',
  imageService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})
