import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'

defineMusicServiceTest({
  models: [
    { model: 'lyria-3-pro-preview', prompt: 'cinematic synth pop song with verses, chorus, bridge, and hopeful vocals', extraArgs: ['--duration', '30'] },
  ],
  provider: 'gemini',
  musicService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})
