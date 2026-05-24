import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { openaiImage } from './cases'

defineImageServiceTest({
  ...openaiImage,
  models: [
    { model: 'gpt-image-1.5', prompt: 'a watercolor landscape with a lighthouse' },
  ],
  imageService: 'openai',
})

