import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'

defineImageServiceTest({
  imageService: 'grok',
  provider: 'grok',
  envVarKey: 'XAI_API_KEY',
  imageExtension: 'jpg',
  models: [
    {
      model: 'grok-imagine-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--aspect-ratio', '1:1', '--size', '1K']
    },
    {
      model: 'grok-imagine-image-quality',
      prompt: 'A simple blue cube on a white background',
      extraArgs: ['--size', '1K', '--aspect-ratio', '1:1']
    }
  ]
})
