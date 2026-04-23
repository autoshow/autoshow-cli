import type { OcrTarget } from '~/types'
import { ensureProviderReady } from '~/features/bootstrap-broker'
import { getStep2BootstrapProviderId } from '../step-2-shared/provider-registry'

const toBootstrapProviderId = (
  target: Pick<OcrTarget, 'service' | 'model'>
): string => {
  return getStep2BootstrapProviderId('ocr', target.service) ?? ''
}

export const ensureOcrTargetSetup = async (
  target: Pick<OcrTarget, 'service' | 'model'>
): Promise<void> => {
  await ensureProviderReady(toBootstrapProviderId(target))
}
