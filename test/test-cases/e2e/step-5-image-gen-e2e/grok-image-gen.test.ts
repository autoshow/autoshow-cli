import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  imageService: 'grok',
  cliFlag: '--grok-image',
  envVarKey: 'XAI_API_KEY',
  imageExtension: 'png',
  models: [
    {
      model: 'grok-imagine-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-aspect-ratio', '1:1', '--image-size', '1K']
    }
  ]
})
