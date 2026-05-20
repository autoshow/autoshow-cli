import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  imageService: 'grok',
  cliFlag: '--grok',
  envVarKey: 'XAI_API_KEY',
  imageExtension: 'jpg',
  models: [
    {
      model: 'grok-imagine-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-aspect-ratio', '1:1', '--image-size', '1K']
    },
    {
      model: 'grok-imagine-image-quality',
      prompt: 'A simple blue cube on a white background',
      extraArgs: ['--image-size', '1K', '--image-aspect-ratio', '1:1']
    }
  ]
})
