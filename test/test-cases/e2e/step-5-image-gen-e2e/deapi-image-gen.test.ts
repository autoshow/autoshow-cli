import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  imageService: 'deapi',
  cliFlag: '--deapi',
  envVarKey: 'DEAPI_API_KEY',
  imageExtension: 'png',
  models: [
    {
      model: 'Flux1schnell',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '512x512']
    },
    {
      model: 'ZImageTurbo_INT8',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '512x512']
    },
    {
      model: 'Flux_2_Klein_4B_BF16',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '512x512']
    }
  ]
})
