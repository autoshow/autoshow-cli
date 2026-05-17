import type { CliFlagDefinition, CliFlagsDefinition } from '~/cli/native'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from '~/cli/commands/process-steps/service-selector-normalization'
import {
  getStep2ProviderEntry,
  getStep2ProviderSelectionFlagNames
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { ocrCommandFlags } from './ocr-flags'
import { sttFlags } from './stt-flags'
import { omitFlags } from './flag-utils'

const STT_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('stt')
const OCR_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('ocr')

const providerDisplayName = (publicName: string): string => {
  switch (publicName) {
    case 'gcloud':
      return 'Google Cloud'
    case 'aws':
      return 'AWS'
    case 'glm':
      return 'GLM'
    case 'ocrmypdf':
      return 'OCRmyPDF'
    default:
      return publicName.charAt(0).toUpperCase() + publicName.slice(1)
  }
}

const modelSelectorDefinition = (
  publicName: string
): CliFlagDefinition => {
  const label = providerDisplayName(publicName)
  return {
    description: `${label} route-aware provider/model selector; media inputs use STT and document/image inputs use OCR. Omit the model for the cheapest supported route-specific model.`,
    type: [String] as [StringConstructor]
  }
}

const buildExtractSelectorFlags = (): CliFlagsDefinition => {
  const flags: CliFlagsDefinition = {}
  for (const [publicName, target] of Object.entries(EXTRACT_PUBLIC_SELECTOR_FLAGS)) {
    const sttEntry = target.stt ? getStep2ProviderEntry(target.stt) : undefined
    const ocrEntry = target.ocr ? getStep2ProviderEntry(target.ocr) : undefined
    const hasModelSelector = sttEntry?.selection.type === 'models' || ocrEntry?.selection.type === 'models'

    flags[publicName] = hasModelSelector
      ? modelSelectorDefinition(publicName)
      : {
          ...(sttEntry?.flag ?? ocrEntry?.flag),
          description: sttEntry?.flag.description ?? ocrEntry?.flag.description ?? `${providerDisplayName(publicName)} provider selector`
        } as CliFlagDefinition
  }
  return flags
}

export const extractStep2CommandFlags = {
  'all-stt': sttFlags['all-stt'],
  'all-ocr': ocrCommandFlags['all-ocr'],
  ...buildExtractSelectorFlags(),
  ...omitFlags(sttFlags, ['all-stt', ...STT_PROVIDER_FLAGS]),
  ...omitFlags(ocrCommandFlags, ['all-ocr', ...OCR_PROVIDER_FLAGS])
} as const satisfies CliFlagsDefinition
