import { defineMusicServiceTest } from '../../../test-utils/define-music-service-test'

defineMusicServiceTest({
  models: [
    {
      model: 'AceStep_1_5_Turbo',
      prompt: 'tight electronic instrumental cue with bright synth hooks',
      extraArgs: ['--music-duration', '10', '--music-instrumental'],
      expectedLyricsSource: 'none',
    },
    {
      model: 'AceStep_1_5_XL_Turbo_INT8',
      prompt: 'driving cinematic instrumental with percussion and bass pulses',
      extraArgs: ['--music-duration', '10', '--music-instrumental'],
      expectedLyricsSource: 'none',
    },
    {
      model: 'AceStep_1_5_Base',
      prompt: 'warm ambient instrumental with soft piano and slow strings',
      extraArgs: ['--music-duration', '30', '--music-instrumental'],
      expectedLyricsSource: 'none',
    },
  ],
  cliFlag: '--deapi',
  musicService: 'deapi',
  envVarKey: 'DEAPI_API_KEY',
})
