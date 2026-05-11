import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import {
  buildHappyScribeOrganizationResolutionError,
  resolveHappyScribeOrganizationSelection
} from './happyscribe'

const GENERIC_ESTIMATE_NOTE = 'Happy Scribe preflight uses the published $0.01/min AI rate; exact billed cents and credits are captured only on real runs.'

export const buildHappyScribeRegistryEstimate = (
  model: string,
  durationSeconds: number
): number => computeBilledSttCost('happyscribe', model, durationSeconds).cost

export const resolveHappyScribePriceNotes = async (
  options: {
    preferredOrganizationId?: string | undefined
  }
): Promise<string[]> => {
  const notes = [GENERIC_ESTIMATE_NOTE]
  if (!process.env['HAPPYSCRIBE_API_KEY']) {
    return notes
  }

  try {
    const selection = await resolveHappyScribeOrganizationSelection({
      preferredOrganizationId: options.preferredOrganizationId
    })
    if (!selection.selected) {
      notes.push(`${buildHappyScribeOrganizationResolutionError(selection).message} Price output remains a generic estimate until execution.`)
      return notes
    }

    if (selection.selected.currency && selection.selected.currency !== 'usd') {
      notes.push(`Happy Scribe organization ${selection.selected.id}${selection.selected.name ? ` (${selection.selected.name})` : ''} reports currency ${selection.selected.currency}; v1 execution supports exact-cost capture only for usd organizations.`)
    }
  } catch (error) {
    notes.push(`Happy Scribe organization lookup was skipped during pricing (${error instanceof Error ? error.message : String(error)}).`)
  }

  return notes
}
