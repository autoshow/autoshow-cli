import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { bflImage } from './cases'

defineImageServiceTest({
  ...bflImage,
  models: [
    {
      model: 'flux-2-pro',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--size', '1024x1024', '--format', 'jpeg']
    },
  ],
  imageService: 'bfl',
})

