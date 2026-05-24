import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'
import { geminiMusic } from './cases'

defineMusicServiceTest({
  ...geminiMusic,
  models: [
    { model: 'lyria-3-pro-preview', prompt: 'cinematic synth pop song with verses, chorus, bridge, and hopeful vocals', extraArgs: ['--duration', '30'] },
  ],
  musicService: 'gemini',
})

