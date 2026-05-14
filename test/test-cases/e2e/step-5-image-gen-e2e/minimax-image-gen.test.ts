import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'

defineImageServiceTest({
  models: [
    { model: 'image-01', prompt: 'a dramatic fox portrait in snow', extraArgs: ['--image-aspect-ratio', '16:9'] },
  ],
  cliFlag: '--minimax-image',
  imageService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  imageExtension: 'jpeg',
})
