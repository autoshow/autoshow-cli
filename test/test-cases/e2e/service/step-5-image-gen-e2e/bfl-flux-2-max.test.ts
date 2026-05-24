import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { bflImage } from './cases'

defineImageServiceTest({
  ...bflImage,
  models: [
    {
      model: 'flux-2-max',
      prompt: 'A tiny blue square on a white background',
      extraArgs: ['--size', '64x64', '--format', 'jpeg']
    },
  ],
  imageService: 'bfl',
})

