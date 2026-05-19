import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  imageService: 'runway',
  cliFlag: '--runway',
  envVarKey: 'RUNWAYML_API_SECRET',
  imageExtension: 'png',
  models: [
    {
      model: 'gen4_image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-aspect-ratio', '1:1', '--image-size', '720p']
    }
  ]
})
