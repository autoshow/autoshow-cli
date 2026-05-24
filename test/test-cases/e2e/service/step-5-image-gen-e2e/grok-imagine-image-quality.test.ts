import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { grokImage } from './cases'

defineImageServiceTest({
  ...grokImage,
  models: [
    {
      model: 'grok-imagine-image-quality',
      prompt: 'A simple blue cube on a white background',
      extraArgs: ['--size', '1K', '--aspect-ratio', '1:1']
    },
  ],
  imageService: 'grok',
})

