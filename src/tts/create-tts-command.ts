import { Command } from 'commander'
import { err, success } from '@/logging'
import { 
  existsSync, extname, mkdirSync
} from '@/node-utils'
import { processFileWithEngine } from './tts-commands/file-command'
import { processScriptWithEngine } from './tts-commands/script-command'
import { detectEngine } from './tts-utils/engine-utils'
import { createJsonOutput, setJsonError, outputJson, type TtsJsonOutput } from '@/utils'

const OUTDIR = 'output'

const sharedOptions = (cmd: Command): Command => cmd
  .option('--elevenlabs', 'Use ElevenLabs engine')
  .option('--polly', 'Use AWS Polly engine')
  .option('--qwen3', 'Use Qwen3 TTS engine (default)')
  .option('--chatterbox', 'Use Chatterbox TTS engine (GPU/MPS recommended)')
  .option('--chatterbox-model <model>', 'Chatterbox model: turbo, standard (default: turbo)')
  .option('--chatterbox-device <device>', 'Device override: cpu, mps, cuda')
  .option('--chatterbox-dtype <dtype>', 'Dtype override: float32, float16, bfloat16')
  .option('--chatterbox-exaggeration <n>', 'Exaggeration level 0.0-1.0 (standard model)', parseFloat)
  .option('--chatterbox-cfg <n>', 'CFG weight 0.0-1.0 (standard model)', parseFloat)
  .option('--fish-audio', 'Use FishAudio TTS engine (S1-mini)')
  .option('--fish-language <lang>', 'Language code: en, zh, ja, de, fr, es, ko, etc.')
  .option('--fish-api-url <url>', 'FishAudio API server URL (default: http://localhost:8080)')
  .option('--fish-emotion <emotion>', 'Emotion marker: excited, sad, whispering, etc.')
  .option('--fish-device <device>', 'Device override: cpu, mps, cuda')
  .option('--cosyvoice', 'Use CosyVoice3 TTS engine (multilingual, voice cloning)')
  .option('--cosy-mode <mode>', 'CosyVoice mode: instruct (default), zero_shot, cross_lingual')
  .option('--cosy-language <lang>', 'Language: auto, zh, en, ja, ko, de, es, fr, it, ru')
  .option('--cosy-api-url <url>', 'CosyVoice API server URL (default: http://localhost:50000)')
  .option('--cosy-instruct <text>', 'Voice instruction (e.g., "Speak with enthusiasm", "Use Cantonese")')
  .option('--cosy-stream', 'Enable streaming inference')
  .option('--qwen3-model <model>', 'Qwen3 model variant (CustomVoice, VoiceDesign, Base)')
  .option('--qwen3-speaker <name>', 'Qwen3 speaker: Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, Sohee')
  .option('--qwen3-instruct <text>', 'Qwen3 natural language voice control')
  .option('--qwen3-mode <mode>', 'Qwen3 generation mode: custom, design, clone')
  .option('--qwen3-language <lang>', 'Qwen3 language: Auto, Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian')
  .option('--qwen3-max-chunk <n>', 'Qwen3 max chunk size for long text (default: 500)', parseInt)
  .option('--ref-audio <path>', 'Reference audio for voice cloning (qwen3 clone mode)')
  .option('--ref-text <text>', 'Transcript of reference audio (qwen3 clone mode)')
  .option('--voice <name>', 'Voice ID (elevenlabs) or voice name (polly)')
  .option('--language <code>', 'Language code for multi-lingual models (polly)')
  .option('--polly-format <format>', 'Polly output format: mp3, ogg_vorbis, pcm (default: mp3)')
  .option('--polly-sample-rate <rate>', 'Polly sample rate: 8000, 16000, 22050, 24000 (default: 24000)')
  .option('--polly-engine <engine>', 'Polly engine: standard, neural (auto-selected based on voice)')
  .option('--output <dir>', 'Output directory', OUTDIR)
  .option('--speed <number>', 'Speed 0.25-4.0 (qwen3)', parseFloat)
  
  .option('--elevenlabs-key-file <path>', 'Path to file containing ElevenLabs API key')

export const createTtsCommand = (): Command => {
  const tts = new Command('tts').description('Text-to-speech operations')

  sharedOptions(tts)
    .argument('<path>', 'Path to a .md, .txt, or .json file')
    .action(async (inputPath, options) => {
      const jsonBuilder = createJsonOutput<TtsJsonOutput>('tts')

      try {
        if (!existsSync(inputPath)) {
          setJsonError(jsonBuilder, `File not found: ${inputPath}`)
          outputJson(jsonBuilder)
          err(`File not found: ${inputPath}`)
          return
        }

        const outputDir = options.output || OUTDIR
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true })
        }

        const extension = extname(inputPath).toLowerCase()
        if (extension === '.md' || extension === '.txt') {
          await processFileWithEngine(detectEngine(options), inputPath, outputDir, options)
        } else if (extension === '.json') {
          await processScriptWithEngine(detectEngine(options), inputPath, outputDir, options)
        } else {
          const message = `Unsupported file type: ${extension || 'unknown'}. Use .md, .txt, or .json.`
          setJsonError(jsonBuilder, message)
          outputJson(jsonBuilder)
          err(message)
          return
        }

        jsonBuilder.output.data = {
          inputPath,
          outputPath: outputDir,
          service: detectEngine(options)
        }
        outputJson(jsonBuilder)
        success(`Speech saved to ${outputDir}`)
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
        err(`Error generating speech: ${error}`)
      }
    })

  tts.addHelpText('after', `
Examples:
  $ autoshow-cli tts ./input/sample.md --qwen3
  $ autoshow-cli tts ./input/story.md --elevenlabs --voice "Rachel"
  $ autoshow-cli tts ./input/script.json --qwen3
`)

  return tts
}
