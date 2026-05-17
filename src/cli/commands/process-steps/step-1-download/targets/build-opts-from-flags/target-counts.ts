import type { readRuntimeModelOptions } from '../options/model-options'

type RuntimeModelOptions = ReturnType<typeof readRuntimeModelOptions>

const countSelectedTargets = (
  models: string[] | undefined,
  model: string | undefined
): number => models?.length ?? (model ? 1 : 0)

export type TargetCounts = {
  hostedOcrTargetCount: number
  hostedLlmTargetCount: number
  hostedTtsTargetCount: number
  hostedImageTargetCount: number
  hostedVideoTargetCount: number
  hostedMusicTargetCount: number
}

export const resolveTargetCounts = (modelOptions: RuntimeModelOptions): TargetCounts => {
  const hostedOcrTargetCount =
    countSelectedTargets(modelOptions.mistralOcrModels, modelOptions.mistralOcrModel)
    + countSelectedTargets(modelOptions.glmOcrModels, modelOptions.glmOcrModel)
    + countSelectedTargets(modelOptions.kimiOcrModels, modelOptions.kimiOcrModel)
    + countSelectedTargets(modelOptions.openaiOcrModels, modelOptions.openaiOcrModel)
    + countSelectedTargets(modelOptions.anthropicOcrModels, modelOptions.anthropicOcrModel)
    + countSelectedTargets(modelOptions.geminiOcrModels, modelOptions.geminiOcrModel)
    + countSelectedTargets(modelOptions.deepinfraOcrModels, modelOptions.deepinfraOcrModel)
    + countSelectedTargets(modelOptions.awsTextractModels, modelOptions.awsTextractModel)
    + countSelectedTargets(modelOptions.gcloudDocaiModels, modelOptions.gcloudDocaiModel)
  const hostedLlmTargetCount =
    countSelectedTargets(modelOptions.openaiModels, modelOptions.openaiModel)
    + countSelectedTargets(modelOptions.groqModels, modelOptions.groqModel)
    + countSelectedTargets(modelOptions.geminiModels, modelOptions.geminiModel)
    + countSelectedTargets(modelOptions.anthropicModels, modelOptions.anthropicModel)
    + countSelectedTargets(modelOptions.minimaxModels, modelOptions.minimaxModel)
    + countSelectedTargets(modelOptions.grokModels, modelOptions.grokModel)
    + countSelectedTargets(modelOptions.glmModels, modelOptions.glmModel)
    + countSelectedTargets(modelOptions.kimiModels, modelOptions.kimiModel)
  const hostedTtsTargetCount =
    countSelectedTargets(modelOptions.elevenlabsTtsModels, modelOptions.elevenlabsTtsModel)
    + countSelectedTargets(modelOptions.minimaxTtsModels, modelOptions.minimaxTtsModel)
    + countSelectedTargets(modelOptions.groqTtsModels, modelOptions.groqTtsModel)
    + countSelectedTargets(modelOptions.grokTtsModels, modelOptions.grokTtsModel)
    + countSelectedTargets(modelOptions.mistralTtsModels, modelOptions.mistralTtsModel)
    + countSelectedTargets(modelOptions.openaiTtsModels, modelOptions.openaiTtsModel)
    + countSelectedTargets(modelOptions.geminiTtsModels, modelOptions.geminiTtsModel)
    + countSelectedTargets(modelOptions.deepgramTtsModels, modelOptions.deepgramTtsModel)
    + countSelectedTargets(modelOptions.speechifyTtsModels, modelOptions.speechifyTtsModel)
    + countSelectedTargets(modelOptions.humeTtsModels, modelOptions.humeTtsModel)
    + countSelectedTargets(modelOptions.cartesiaTtsModels, modelOptions.cartesiaTtsModel)
    + countSelectedTargets(modelOptions.gcloudTtsModels, modelOptions.gcloudTtsModel)
    + countSelectedTargets(modelOptions.deapiTtsModels, modelOptions.deapiTtsModel)
  const hostedImageTargetCount =
    countSelectedTargets(modelOptions.geminiImageModels, modelOptions.geminiImageModel)
    + countSelectedTargets(modelOptions.openaiImageModels, modelOptions.openaiImageModel)
    + countSelectedTargets(modelOptions.minimaxImageModels, modelOptions.minimaxImageModel)
    + countSelectedTargets(modelOptions.glmImageModels, modelOptions.glmImageModel)
    + countSelectedTargets(modelOptions.grokImageModels, modelOptions.grokImageModel)
    + countSelectedTargets(modelOptions.runwayImageModels, modelOptions.runwayImageModel)
    + countSelectedTargets(modelOptions.bflImageModels, modelOptions.bflImageModel)
    + countSelectedTargets(modelOptions.deapiImageModels, modelOptions.deapiImageModel)
  const hostedVideoTargetCount =
    countSelectedTargets(modelOptions.geminiVideoModels, modelOptions.geminiVideoModel)
    + countSelectedTargets(modelOptions.minimaxVideoModels, modelOptions.minimaxVideoModel)
    + countSelectedTargets(modelOptions.glmVideoModels, modelOptions.glmVideoModel)
    + countSelectedTargets(modelOptions.grokVideoModels, modelOptions.grokVideoModel)
    + countSelectedTargets(modelOptions.runwayVideoModels, modelOptions.runwayVideoModel)
    + countSelectedTargets(modelOptions.deapiVideoModels, modelOptions.deapiVideoModel)
  const hostedMusicTargetCount =
    countSelectedTargets(modelOptions.elevenlabsMusicModels, modelOptions.elevenlabsMusicModel)
    + countSelectedTargets(modelOptions.minimaxMusicModels, modelOptions.minimaxMusicModel)
    + countSelectedTargets(modelOptions.deapiMusicModels, modelOptions.deapiMusicModel)
    + countSelectedTargets(modelOptions.geminiMusicModels, modelOptions.geminiMusicModel)

  return {
    hostedOcrTargetCount,
    hostedLlmTargetCount,
    hostedTtsTargetCount,
    hostedImageTargetCount,
    hostedVideoTargetCount,
    hostedMusicTargetCount,
  }
}
