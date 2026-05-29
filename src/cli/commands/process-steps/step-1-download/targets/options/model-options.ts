import { CLIUsageError } from '~/utils/error-handler'
import {
  validateLlamaModel,
  validateOpenAIModel,
  validateGroqModel,
  validateGeminiModel,
  validateAnthropicModel,
  validateMinimaxModel,
  validateGrokModel,
  validateGlmModel,
  validateKimiModel,
  validateWhisperModel,
  validateDeepinfraSttModel,
  validateElevenlabsSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateRevSttModel,
  validateGroqSttModel,
  validateGrokSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateHappyscribeSttModel,
  validateSupadataSttModel,
  validateScrapeCreatorsSttModel,
  validateOpenaiSttModel,
  validateGeminiSttModel,
  validateGlmSttModel,
  validateTogetherSttModel,
  validateGlmOcrModel,
  validateKimiOcrModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel,
  validateDeepinfraOcrModel,
  validateUnstructuredOcrModel,
  validateMistralOcrModel,
  validateOpenAIOcrModel,
  validateGrokOcrModel,
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateGrokTtsModel,
  validateMistralTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateDeepgramTtsModel,
  validateSpeechifyTtsModel,
  validateHumeTtsModel,
  validateCartesiaTtsModel,
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel,
  validateGeminiMusicModel,
  validateGeminiImageModel,
  validateGrokImageModel,
  validateOpenAIImageModel,
  validateBflImageModel,
  validateReveImageModel,
  validateGeminiVideoModel,
  validateMinimaxVideoModel,
  validateGlmVideoModel,
  validateGrokVideoModel,
  validateRunwayVideoModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import type { AllShortcutFlag, BuildOptsDefaults, FlagOccurrenceValue, RepeatableModelFlag } from '~/types'
import { readStringFlag } from './flag-readers'
import { appendUnique, expandAllShortcutModels } from './model-flag-selection'

const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'

export const validateCliValue = <T>(validator: (value: string) => T, value: string): T => {
  try {
    return validator(value)
  } catch (error) {
    throw CLIUsageError(error instanceof Error ? error.message : String(error))
  }
}
const first = <T>(values: T[] | undefined): T | undefined => values?.[0]

export const readRuntimeModelOptions = (
  flags: Record<string, unknown>,
  rawModelOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>,
  defaults: BuildOptsDefaults
) => {
  const mergedFlags = flags
  const readValidatedMany = <T extends string>(
    key: RepeatableModelFlag,
    validator: (value: string) => T
  ): T[] | undefined => {
    const values = expandAllShortcutModels(key, mergedFlags, rawModelOccurrences, allShortcutFlags)
    if (!values || values.length === 0) {
      return undefined
    }

    const normalized: T[] = []
    for (const value of values) {
      appendUnique(normalized, validateCliValue(validator, value))
    }
    return normalized.length > 0 ? normalized : undefined
  }

  const whisperModels = readValidatedMany('whisper-stt', validateWhisperModel)
  const whisperModel = first(whisperModels) ?? validateCliValue(validateWhisperModel, readStringFlag(mergedFlags, 'whisper-stt', 'tiny'))
  const deepinfraSttModels = readValidatedMany('deepinfra-stt', validateDeepinfraSttModel)
  const groqSttModels = readValidatedMany('groq-stt', validateGroqSttModel)
  const grokSttModels = readValidatedMany('grok-stt', validateGrokSttModel)
  const elevenlabsSttModels = readValidatedMany('elevenlabs-stt', validateElevenlabsSttModel)
  const deepgramSttModels = readValidatedMany('deepgram-stt', validateDeepgramSttModel)
  const sonioxSttModels = readValidatedMany('soniox-stt', validateSonioxSttModel)
  const speechmaticsSttModels = readValidatedMany('speechmatics-stt', validateSpeechmaticsSttModel)
  const revSttModels = readValidatedMany('rev-stt', validateRevSttModel)
  const mistralSttModels = readValidatedMany('mistral-stt', validateMistralSttModel)
  const assemblyaiSttModels = readValidatedMany('assemblyai-stt', validateAssemblyaiSttModel)
  const gladiaSttModels = readValidatedMany('gladia-stt', validateGladiaSttModel)
  const happyscribeSttModels = readValidatedMany('happyscribe-stt', validateHappyscribeSttModel)
  const supadataSttModels = readValidatedMany('supadata-stt', validateSupadataSttModel)
  const scrapecreatorsSttModels = readValidatedMany('scrapecreators-stt', validateScrapeCreatorsSttModel)
  const openaiSttModels = readValidatedMany('openai-stt', validateOpenaiSttModel)
  const geminiSttModels = readValidatedMany('gemini-stt', validateGeminiSttModel)
  const glmSttModels = readValidatedMany('glm-stt', validateGlmSttModel)
  const togetherSttModels = readValidatedMany('together-stt', validateTogetherSttModel)
  const mistralOcrModels = readValidatedMany('mistral-ocr', validateMistralOcrModel)
  const glmOcrModels = readValidatedMany('glm-ocr', validateGlmOcrModel)
  const kimiOcrModels = readValidatedMany('kimi-ocr', validateKimiOcrModel)
  const openaiOcrModels = readValidatedMany('openai-ocr', validateOpenAIOcrModel)
  const grokOcrModels = readValidatedMany('grok-ocr', validateGrokOcrModel)
  const anthropicOcrModels = readValidatedMany('anthropic-ocr', validateAnthropicOcrModel)
  const geminiOcrModels = readValidatedMany('gemini-ocr', validateGeminiOcrModel)
  const deepinfraOcrModels = readValidatedMany('deepinfra-ocr', validateDeepinfraOcrModel)
  const unstructuredOcrModels = readValidatedMany('unstructured-ocr', validateUnstructuredOcrModel)
  const llamaModels = readValidatedMany('llama', validateLlamaModel)
  const openaiModels = readValidatedMany('openai', validateOpenAIModel)
  const groqModels = readValidatedMany('groq', validateGroqModel)
  const geminiModels = readValidatedMany('gemini', validateGeminiModel)
  const anthropicModels = readValidatedMany('anthropic', validateAnthropicModel)
  const minimaxModels = readValidatedMany('minimax', validateMinimaxModel)
  const grokModels = readValidatedMany('grok', validateGrokModel)
  const glmModels = readValidatedMany('glm', validateGlmModel)
  const kimiModels = readValidatedMany('kimi', validateKimiModel)
  const deepinfraSttModel = first(deepinfraSttModels)
  const groqSttModel = first(groqSttModels)
  const grokSttModel = first(grokSttModels)
  const elevenlabsSttModel = first(elevenlabsSttModels)
  const deepgramSttModel = first(deepgramSttModels)
  const sonioxSttModel = first(sonioxSttModels)
  const speechmaticsSttModel = first(speechmaticsSttModels)
  const revSttModel = first(revSttModels)
  const mistralSttModel = first(mistralSttModels)
  const assemblyaiSttModel = first(assemblyaiSttModels)
  const gladiaSttModel = first(gladiaSttModels)
  const happyscribeSttModel = first(happyscribeSttModels)
  const supadataSttModel = first(supadataSttModels)
  const scrapecreatorsSttModel = first(scrapecreatorsSttModels)
  const openaiSttModel = first(openaiSttModels)
  const geminiSttModel = first(geminiSttModels)
  const glmSttModel = first(glmSttModels)
  const togetherSttModel = first(togetherSttModels)
  const mistralOcrModel = first(mistralOcrModels)
  const glmOcrModel = first(glmOcrModels)
  const kimiOcrModel = first(kimiOcrModels)
  const openaiOcrModel = first(openaiOcrModels)
  const grokOcrModel = first(grokOcrModels)
  const anthropicOcrModel = first(anthropicOcrModels)
  const geminiOcrModel = first(geminiOcrModels)
  const deepinfraOcrModel = first(deepinfraOcrModels)
  const unstructuredOcrModel = first(unstructuredOcrModels)
  const llamaModel = first(llamaModels)
  const openaiModel = first(openaiModels)
  const groqModel = first(groqModels)
  const geminiModel = first(geminiModels)
  const anthropicModel = first(anthropicModels)
  const minimaxModel = first(minimaxModels)
  const grokModel = first(grokModels)
  const glmModel = first(glmModels)
  const kimiModel = first(kimiModels)
  const kittenTtsModels = readValidatedMany('kitten-tts', validateKittenTtsModel)
  const elevenlabsTtsModels = readValidatedMany('elevenlabs-tts', validateElevenlabsTtsModel)
  const minimaxTtsModels = readValidatedMany('minimax-tts', validateMinimaxTtsModel)
  const groqTtsModels = readValidatedMany('groq-tts', validateGroqTtsModel)
  const grokTtsModels = readValidatedMany('grok-tts', validateGrokTtsModel)
  const mistralTtsModels = readValidatedMany('mistral-tts', validateMistralTtsModel)
  const openaiTtsModels = readValidatedMany('openai-tts', validateOpenAITtsModel)
  const geminiTtsModels = readValidatedMany('gemini-tts', validateGeminiTtsModel)
  const deepgramTtsModels = readValidatedMany('deepgram-tts', validateDeepgramTtsModel)
  const speechifyTtsModels = readValidatedMany('speechify-tts', validateSpeechifyTtsModel)
  const humeTtsModels = readValidatedMany('hume-tts', validateHumeTtsModel)
  const cartesiaTtsModels = readValidatedMany('cartesia-tts', validateCartesiaTtsModel)
  const hasExplicitTtsEngine = [
    kittenTtsModels,
    elevenlabsTtsModels,
    minimaxTtsModels,
    groqTtsModels,
    grokTtsModels,
    mistralTtsModels,
    openaiTtsModels,
    geminiTtsModels,
    deepgramTtsModels,
    speechifyTtsModels,
    humeTtsModels,
    cartesiaTtsModels,
  ].some((value) => value !== undefined && value.length > 0)
  const kittenTtsModelValues = defaults.defaultTtsEngine === 'kitten' && !hasExplicitTtsEngine
    ? [DEFAULT_KITTEN_TTS_MODEL]
    : kittenTtsModels
  const kittenTtsModelValue = first(kittenTtsModelValues)
  const geminiImageModels = readValidatedMany('gemini-image', validateGeminiImageModel)
  const openaiImageModels = readValidatedMany('openai-image', validateOpenAIImageModel)
  const grokImageModels = readValidatedMany('grok-image', validateGrokImageModel)
  const bflImageModels = readValidatedMany('bfl-image', validateBflImageModel)
  const reveImageModels = readValidatedMany('reve-image', validateReveImageModel)
  const elevenlabsMusicModels = readValidatedMany('elevenlabs-music', validateElevenlabsMusicModel)
  const minimaxMusicModels = readValidatedMany('minimax-music', validateMinimaxMusicModel)
  const geminiMusicModels = readValidatedMany('gemini-music', validateGeminiMusicModel)
  const geminiVideoModels = readValidatedMany('gemini-video', validateGeminiVideoModel)
  const minimaxVideoModels = readValidatedMany('minimax-video', validateMinimaxVideoModel)
  const glmVideoModels = readValidatedMany('glm-video', validateGlmVideoModel)
  const grokVideoModels = readValidatedMany('grok-video', validateGrokVideoModel)
  const runwayVideoModels = readValidatedMany('runway-video', validateRunwayVideoModel)

  return {
    whisperModels,
    whisperModel,
    deepinfraSttModels,
    deepinfraSttModel,
    groqSttModels,
    groqSttModel,
    grokSttModels,
    grokSttModel,
    elevenlabsSttModels,
    elevenlabsSttModel,
    deepgramSttModels,
    deepgramSttModel,
    sonioxSttModels,
    sonioxSttModel,
    speechmaticsSttModels,
    speechmaticsSttModel,
    revSttModels,
    revSttModel,
    mistralSttModels,
    mistralSttModel,
    assemblyaiSttModels,
    assemblyaiSttModel,
    gladiaSttModels,
    gladiaSttModel,
    happyscribeSttModels,
    happyscribeSttModel,
    supadataSttModels,
    supadataSttModel,
    scrapecreatorsSttModels,
    scrapecreatorsSttModel,
    openaiSttModels,
    openaiSttModel,
    geminiSttModels,
    geminiSttModel,
    glmSttModels,
    glmSttModel,
    togetherSttModels,
    togetherSttModel,
    mistralOcrModels,
    mistralOcrModel,
    glmOcrModels,
    glmOcrModel,
    kimiOcrModels,
    kimiOcrModel,
    openaiOcrModels,
    openaiOcrModel,
    grokOcrModels,
    grokOcrModel,
    anthropicOcrModels,
    anthropicOcrModel,
    geminiOcrModels,
    geminiOcrModel,
    deepinfraOcrModels,
    deepinfraOcrModel,
    unstructuredOcrModels,
    unstructuredOcrModel,
    llamaModels,
    llamaModel,
    openaiModels,
    openaiModel,
    groqModels,
    groqModel,
    geminiModels,
    geminiModel,
    anthropicModels,
    anthropicModel,
    minimaxModels,
    minimaxModel,
    grokModels,
    grokModel,
    glmModels,
    glmModel,
    kimiModels,
    kimiModel,
    kittenTtsModelValues,
    kittenTtsModelValue,
    elevenlabsTtsModels,
    elevenlabsTtsModel: first(elevenlabsTtsModels),
    minimaxTtsModels,
    minimaxTtsModel: first(minimaxTtsModels),
    groqTtsModels,
    groqTtsModel: first(groqTtsModels),
    grokTtsModels,
    grokTtsModel: first(grokTtsModels),
    mistralTtsModels,
    mistralTtsModel: first(mistralTtsModels),
    openaiTtsModels,
    openaiTtsModel: first(openaiTtsModels),
    geminiTtsModels,
    geminiTtsModel: first(geminiTtsModels),
    deepgramTtsModels,
    deepgramTtsModel: first(deepgramTtsModels),
    speechifyTtsModels,
    speechifyTtsModel: first(speechifyTtsModels),
    humeTtsModels,
    humeTtsModel: first(humeTtsModels),
    cartesiaTtsModels,
    cartesiaTtsModel: first(cartesiaTtsModels),
    geminiImageModels,
    geminiImageModel: first(geminiImageModels),
    openaiImageModels,
    openaiImageModel: first(openaiImageModels),
    grokImageModels,
    grokImageModel: first(grokImageModels),
    bflImageModels,
    bflImageModel: first(bflImageModels),
    reveImageModels,
    reveImageModel: first(reveImageModels),
    elevenlabsMusicModels,
    elevenlabsMusicModel: first(elevenlabsMusicModels),
    minimaxMusicModels,
    minimaxMusicModel: first(minimaxMusicModels),
    geminiMusicModels,
    geminiMusicModel: first(geminiMusicModels),
    geminiVideoModels,
    geminiVideoModel: first(geminiVideoModels),
    minimaxVideoModels,
    minimaxVideoModel: first(minimaxVideoModels),
    glmVideoModels,
    glmVideoModel: first(glmVideoModels),
    grokVideoModels,
    grokVideoModel: first(grokVideoModels),
    runwayVideoModels,
    runwayVideoModel: first(runwayVideoModels)
  }
}
