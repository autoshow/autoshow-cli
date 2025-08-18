import { Command } from 'commander'
import { l, err } from '@/logging'
import { generateMusicWithAudioCraft, listAvailableModels } from './music-services/audiocraft.ts'
import { generateMusicWithStableAudio, listStableAudioModels } from './music-services/stable-audio.ts'
import { validateMusicOptions, getModelDescription } from './music-utils.ts'
import type { MusicService } from './music-types.ts'

const p = '[music/create-music-command]'

export const createMusicCommand = (): Command => {
  const music = new Command('music').description('AI music generation with AudioCraft MusicGen and Stable Audio')

  music
    .command('generate')
    .description('Generate music from text prompts')
    .requiredOption('-p, --prompt <text>', 'text prompt for music generation')
    .option('-o, --output <path>', 'output file path')
    .option('-s, --service <service>', 'service to use: audiocraft or stable-audio', 'audiocraft')
    .option('-m, --model <model>', 'model to use (service-specific)')
    .option('-d, --duration <seconds>', 'duration in seconds', '8')
    .option('-t, --temperature <value>', 'sampling temperature (audiocraft only)', '1.0')
    .option('--top-k <value>', 'top-k sampling (audiocraft only)', '250')
    .option('--top-p <value>', 'nucleus sampling threshold (audiocraft only)', '0.0')
    .option('--cfg-coef <value>', 'classifier free guidance coefficient (audiocraft)', '3.0')
    .option('--cfg-scale <value>', 'classifier free guidance scale (stable-audio)', '7.0')
    .option('--steps <value>', 'diffusion steps (stable-audio only)', '100')
    .option('--sigma-min <value>', 'minimum sigma (stable-audio only)', '0.3')
    .option('--sigma-max <value>', 'maximum sigma (stable-audio only)', '500')
    .option('--sampler-type <type>', 'sampler type (stable-audio only)', 'dpmpp-3m-sde')
    .option('--seed <number>', 'random seed for reproducibility')
    .option('--no-sampling', 'use greedy decoding (audiocraft only)')
    .option('--two-step-cfg', 'use two-step classifier free guidance (audiocraft only)')
    .option('--extend-stride <value>', 'stride for continuation (audiocraft only)', '18')
    .option('--melody <path>', 'path to melody audio file (audiocraft only)')
    .option('--continuation <path>', 'path to audio file for continuation (audiocraft only)')
    .action(async (options) => {
      try {
        const service = options.service as MusicService
        l.dim(`${p} Starting music generation with service: ${service}`)
        
        const validation = validateMusicOptions(options)
        if (!validation.valid) {
          validation.errors.forEach(error => l.warn(`${p} ${error}`))
          err(`${p} Invalid options provided`)
        }
        
        if ((options.melody || options.continuation) && service !== 'audiocraft') {
          err(`${p} Melody and continuation options are only available with AudioCraft`)
        }
        
        l.opts(`${p} Prompt: ${options.prompt}`)
        l.dim(`${p} Service: ${service}`)
        l.dim(`${p} Duration: ${options.duration}s`)
        
        let result
        
        if (service === 'stable-audio') {
          const model = options.model || 'stabilityai/stable-audio-open-1.0'
          l.dim(`${p} Model: ${model}`)
          l.dim(`${p} Steps: ${options.steps}, CFG Scale: ${options.cfgScale}`)
          
          result = await generateMusicWithStableAudio(
            options.prompt,
            options.output,
            {
              model,
              duration: parseFloat(options.duration),
              steps: parseInt(options.steps, 10),
              cfgScale: parseFloat(options.cfgScale),
              sigmaMin: parseFloat(options.sigmaMin),
              sigmaMax: parseFloat(options.sigmaMax),
              samplerType: options.samplerType,
              seed: options.seed ? parseInt(options.seed, 10) : undefined
            }
          )
        } else {
          const model = options.model || 'facebook/musicgen-small'
          l.dim(`${p} Model: ${getModelDescription(model)}`)
          
          result = await generateMusicWithAudioCraft(
            options.prompt,
            options.output,
            {
              model,
              duration: parseFloat(options.duration),
              temperature: parseFloat(options.temperature),
              topK: parseInt(options.topK, 10),
              topP: parseFloat(options.topP),
              cfgCoef: parseFloat(options.cfgCoef),
              useSampling: options.sampling !== false,
              twoStepCfg: options.twoStepCfg,
              extendStride: parseInt(options.extendStride, 10),
              melodyPath: options.melody,
              continuationPath: options.continuation,
              seed: options.seed ? parseInt(options.seed, 10) : undefined
            }
          )
        }
        
        if (result.success) {
          l.success(`${p} Music saved to: ${result.path}`)
        } else {
          err(`${p} Failed to generate music: ${result.error || 'Unknown error'}`)
        }
      } catch (error) {
        err(`${p} Error generating music: ${error}`)
      }
    })

  music
    .command('list')
    .description('List available models')
    .option('-s, --service <service>', 'service to list models for: audiocraft or stable-audio', 'all')
    .action(async (options) => {
      try {
        const service = options.service
        
        if (service === 'all' || service === 'audiocraft') {
          l.dim(`${p} Available AudioCraft MusicGen models:`)
          const audiocraftModels = await listAvailableModels()
          audiocraftModels.forEach(model => {
            console.log(`  ${model} - ${getModelDescription(model)}`)
          })
        }
        
        if (service === 'all' || service === 'stable-audio') {
          l.dim(`${p} Available Stable Audio models:`)
          const stableAudioModels = await listStableAudioModels()
          stableAudioModels.forEach(model => {
            console.log(`  ${model} - Latent diffusion model for 44.1kHz stereo music`)
          })
        }
        
        l.dim(`${p} Use a model with: npm run as -- music generate --prompt "..." --service <service> --model <model>`)
      } catch (error) {
        err(`${p} Error listing models: ${error}`)
      }
    })

  music
    .command('download <model>')
    .description('Download a specific model')
    .option('-s, --service <service>', 'service for the model: audiocraft or stable-audio')
    .action(async (model, options) => {
      try {
        const service = options.service || (model.startsWith('facebook/') ? 'audiocraft' : 'stable-audio')
        l.dim(`${p} Downloading model: ${model} for service: ${service}`)
        
        let result
        if (service === 'stable-audio') {
          result = await generateMusicWithStableAudio(
            'test prompt',
            '/tmp/test.wav',
            { model, duration: 0.1, steps: 1 }
          )
        } else {
          result = await generateMusicWithAudioCraft(
            'test prompt',
            '/tmp/test.wav',
            { model, duration: 0.1 }
          )
        }
        
        if (result.success) {
          l.success(`${p} Model ${model} downloaded successfully`)
        } else {
          err(`${p} Failed to download model: ${model}`)
        }
      } catch (error) {
        err(`${p} Error downloading model: ${error}`)
      }
    })

  return music
}