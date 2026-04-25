import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  imageService: 'glm',
  cliFlag: '--glm-image',
  envVarKey: 'GLM_API_KEY',
  imageExtension: 'png',
  models: [
    {
      model: 'glm-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '1024x1024']
    },
    {
      model: 'cogView-4-250304',
      prompt: 'A simple watercolor lighthouse at sunrise',
      extraArgs: ['--image-size', '1024x1024']
    }
  ]
})
