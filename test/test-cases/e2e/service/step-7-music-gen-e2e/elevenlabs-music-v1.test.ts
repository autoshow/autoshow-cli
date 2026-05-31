import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'
import { elevenlabsMusic } from './cases'

defineMusicServiceTest({
  ...elevenlabsMusic,
  models: [
    { model: 'music_v1', prompt: 'upbeat electronic instrumental with warm synth pads', extraArgs: ['--duration', '3', '--instrumental'] },
  ],
  musicService: 'elevenlabs',
})

