import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { openaiImage } from './cases'

defineImageServiceTest({
  ...openaiImage,
  models: [
    { model: 'gpt-image-2', prompt: 'a simple green triangle on white background', extraArgs: ['--size', '1024x1536', '--quality', 'low'] },
  ],
  imageService: 'openai',
})

