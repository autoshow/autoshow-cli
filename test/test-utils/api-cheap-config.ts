import {
  selectCheapestExtractModel,
  selectCheapestImageModel,
  selectCheapestLlmModel,
  selectCheapestSttModel,
  selectCheapestTtsModel,
  selectCheapestVideoSelection
} from '../../src/cli/commands/setup-and-utilities/models/cheapest-models'
import type { ApiCheapPriceCommand, CheapestVideoSelection, GeminiImageModel, VideoSelection } from '~/types'
import {
  supportsGeminiImageSize
} from '../../src/cli/commands/setup-and-utilities/models/model-options'

const toVideoSelection = (selection: CheapestVideoSelection): VideoSelection => ({
  provider: selection.provider,
  model: selection.model,
  duration: selection.duration,
  ...(selection.size ? { size: selection.size } : {}),
  ...(selection.resolution ? { resolution: selection.resolution } : {}),
  totalCost: selection.totalCost
})

export const appendApiCheapImageArgs = (
  args: string[],
  selection: { service: string, model: string }
): string[] => {
  if (selection.service === 'openai') {
    args.push('--image-size', '1024x1024', '--image-quality', 'low', '--image-format', 'jpeg')
  }

  if (selection.service === 'gemini' && selection.model.startsWith('imagen-')) {
    args.push('--image-count', '1', '--image-aspect-ratio', '1:1')
    if (supportsGeminiImageSize(selection.model as GeminiImageModel)) {
      args.push('--image-size', '1K')
    }
  }

  return args
}

export const buildApiCheapSelections = () => {
  const llmSelections = [
    { service: 'openai', flag: '--openai', envVar: 'OPENAI_API_KEY', model: selectCheapestLlmModel('openai') },
    { service: 'groq', flag: '--groq', envVar: 'GROQ_API_KEY', model: selectCheapestLlmModel('groq') },
    { service: 'gemini', flag: '--gemini', envVar: 'GEMINI_API_KEY', model: selectCheapestLlmModel('gemini') },
    { service: 'anthropic', flag: '--anthropic', envVar: 'ANTHROPIC_API_KEY', model: selectCheapestLlmModel('anthropic') },
    { service: 'minimax', flag: '--minimax', envVar: 'MINIMAX_API_KEY', model: selectCheapestLlmModel('minimax') },
    { service: 'glm', flag: '--glm', envVar: 'GLM_API_KEY', model: selectCheapestLlmModel('glm') },
    { service: 'kimi', flag: '--kimi', envVar: 'KIMI_API_KEY', model: selectCheapestLlmModel('kimi') }
  ]

  const sttSelections = [
    { service: 'elevenlabs', flag: '--elevenlabs', envVar: 'ELEVENLABS_API_KEY', model: selectCheapestSttModel('elevenlabs') },
    { service: 'deepgram', flag: '--deepgram', envVar: 'DEEPGRAM_API_KEY', model: selectCheapestSttModel('deepgram') },
    { service: 'deepinfra', flag: '--deepinfra', envVar: 'DEEPINFRA_API_KEY', model: selectCheapestSttModel('deepinfra') },
    { service: 'soniox', flag: '--soniox', envVar: 'SONIOX_API_KEY', model: selectCheapestSttModel('soniox') },
    { service: 'speechmatics', flag: '--speechmatics', envVar: 'SPEECHMATICS_API_KEY', model: selectCheapestSttModel('speechmatics') },
    { service: 'gladia', flag: '--gladia', envVar: 'GLADIA_API_KEY', model: selectCheapestSttModel('gladia') },
    { service: 'happyscribe', flag: '--happyscribe', envVar: 'HAPPYSCRIBE_API_KEY', model: selectCheapestSttModel('happyscribe') },
    { service: 'groq', flag: '--groq', envVar: 'GROQ_API_KEY', model: selectCheapestSttModel('groq') },
    { service: 'grok', flag: '--grok', envVar: 'XAI_API_KEY', model: selectCheapestSttModel('grok') },
    { service: 'together', flag: '--together', envVar: 'TOGETHER_API_KEY', model: selectCheapestSttModel('together') }
  ]

  const ttsSelections = [
    { service: 'elevenlabs', flag: '--elevenlabs', envVar: 'ELEVENLABS_API_KEY', model: selectCheapestTtsModel('elevenlabs') },
    { service: 'minimax', flag: '--minimax', envVar: 'MINIMAX_API_KEY', model: selectCheapestTtsModel('minimax') },
    { service: 'groq', flag: '--groq', envVar: 'GROQ_API_KEY', model: selectCheapestTtsModel('groq') },
    { service: 'grok', flag: '--grok', envVar: 'XAI_API_KEY', model: selectCheapestTtsModel('grok') },
    { service: 'mistral', flag: '--mistral', envVar: 'MISTRAL_API_KEY', model: selectCheapestTtsModel('mistral') },
    { service: 'openai', flag: '--openai', envVar: 'OPENAI_API_KEY', model: selectCheapestTtsModel('openai') },
    { service: 'gemini', flag: '--gemini', envVar: 'GEMINI_API_KEY', model: selectCheapestTtsModel('gemini') }
  ]

  const imageSelections = [
    { service: 'gemini', flag: '--gemini', envVar: 'GEMINI_API_KEY', model: selectCheapestImageModel('gemini') },
    { service: 'openai', flag: '--openai', envVar: 'OPENAI_API_KEY', model: selectCheapestImageModel('openai') },
    { service: 'minimax', flag: '--minimax', envVar: 'MINIMAX_API_KEY', model: selectCheapestImageModel('minimax') }
  ]

  const videoSelections = [
    toVideoSelection(selectCheapestVideoSelection('gemini')),
    toVideoSelection(selectCheapestVideoSelection('minimax'))
  ] satisfies VideoSelection[]

  const extractSelections = [
    { service: 'mistral', flag: '--mistral', envVar: 'MISTRAL_API_KEY', model: selectCheapestExtractModel('mistral') },
    { service: 'glm', flag: '--glm', envVar: 'GLM_API_KEY', model: selectCheapestExtractModel('glm') },
    { service: 'kimi', flag: '--kimi', envVar: 'KIMI_API_KEY', model: selectCheapestExtractModel('kimi') },
    { service: 'openai', flag: '--openai', envVar: 'OPENAI_API_KEY', model: selectCheapestExtractModel('openai') },
    { service: 'anthropic', flag: '--anthropic', envVar: 'ANTHROPIC_API_KEY', model: selectCheapestExtractModel('anthropic') },
    { service: 'gemini', flag: '--gemini', envVar: 'GEMINI_API_KEY', model: selectCheapestExtractModel('gemini') },
    { service: 'deepinfra', flag: '--deepinfra', envVar: 'DEEPINFRA_API_KEY', model: selectCheapestExtractModel('deepinfra') }
  ]

  return {
    llmSelections,
    sttSelections,
    ttsSelections,
    imageSelections,
    videoSelections,
    extractSelections
  }
}

export const dedupePriceCommands = (commands: ApiCheapPriceCommand[]): ApiCheapPriceCommand[] => {
  const seen = new Set<string>()
  const out: ApiCheapPriceCommand[] = []

  for (const command of commands) {
    const key = command.args.join('\u001f')
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(command)
  }

  return out
}

export const buildApiCheapPriceCommands = (): ApiCheapPriceCommand[] => {
  const shortAudioPath = 'input/examples/audio/0-audio-short.mp3'
  const shortTtsPath = 'input/examples/tts/0-tts-short.txt'
  const imagePrompt = 'a tiny red dot on white background'
  const videoPrompt = 'a static shot of a tiny red dot on white background'

  const {
    llmSelections,
    sttSelections,
    ttsSelections,
    imageSelections,
    videoSelections,
    extractSelections
  } = buildApiCheapSelections()

  const commands: ApiCheapPriceCommand[] = []

  for (const selection of llmSelections) {
    commands.push({
      name: `write-${selection.service}-${selection.model}`,
      args: [
        'src/cli/create-cli.ts',
        'write',
        shortAudioPath,
        selection.flag,
        selection.model,
        '--prompt',
        'shortSummary',
        '--price'
      ]
    })
  }

  for (const selection of sttSelections) {
    const args = [
      'src/cli/create-cli.ts',
      'extract',
      shortAudioPath,
      selection.flag,
      selection.model,
      '--price'
    ]
    commands.push({
      name: `transcribe-${selection.service}-${selection.model}`,
      args
    })
  }

  for (const selection of ttsSelections) {
    commands.push({
      name: `tts-${selection.service}-${selection.model}`,
      args: ['src/cli/create-cli.ts', 'tts', shortTtsPath, selection.flag, selection.model, '--price']
    })
  }

  for (const selection of imageSelections) {
    const args = appendApiCheapImageArgs([
      'src/cli/create-cli.ts',
      'image',
      imagePrompt,
      selection.flag,
      selection.model,
      '--price'
    ], selection)
    commands.push({
      name: `image-${selection.service}-${selection.model}`,
      args
    })
  }

  for (const selection of videoSelections) {
    const args = [
      'src/cli/create-cli.ts',
      'video',
      videoPrompt,
      '--price',
      '--video-duration',
      String(selection.duration)
    ]

    if (selection.provider === 'gemini') {
      args.push('--gemini', selection.model)
      if (selection.resolution) args.push('--video-resolution', selection.resolution)
    } else {
      args.push('--minimax', selection.model)
      if (selection.resolution) args.push('--video-resolution', selection.resolution)
    }

    commands.push({
      name: `video-${selection.provider}-${selection.model}`,
      args
    })
  }

  for (const selection of extractSelections) {
    commands.push({
      name: `extract-${selection.service}-${selection.model}`,
      args: ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', selection.flag, selection.model, '--price']
    })
  }

  return dedupePriceCommands(commands)
}
