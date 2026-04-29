import { defineMusicServiceTest } from '../../../test-utils/define-music-service-test'

defineMusicServiceTest({
  models: [
    { model: 'lyria-3-clip-preview', prompt: 'bright acoustic pop with handclaps and a catchy chorus' },
    { model: 'lyria-3-pro-preview', prompt: 'cinematic synth pop song with verses, chorus, bridge, and hopeful vocals', extraArgs: ['--music-duration', '90'] },
  ],
  cliFlag: '--gemini-music',
  musicService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})
