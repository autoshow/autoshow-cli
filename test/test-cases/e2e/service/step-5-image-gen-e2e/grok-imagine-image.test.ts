import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { grokImage } from './cases'

defineImageServiceTest({
  ...grokImage,
  models: [
    {
      model: 'grok-imagine-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--aspect-ratio', '1:1', '--size', '1K']
    },
  ],
  imageService: 'grok',
})

