const SUPADATA_GENERATE_CREDITS_PER_MINUTE = 2
const SUPADATA_NATIVE_TRANSCRIPT_CREDITS = 1
const SUPADATA_REFERENCE_CREDIT_RATE_CENTS = 1

const formatNumber = (value: number): string =>
  Number(value.toFixed(2)).toString()

const formatDurationMinutes = (durationSeconds: number): string =>
  formatNumber(Math.max(0, durationSeconds) / 60)

const formatApproximateCredits = (credits: number): string =>
  `~${formatNumber(credits)}`

export const SUPADATA_STT_AGGREGATE_NOTE =
  'Supadata STT estimates use the published Basic/Pro auto-recharge rate ($10 / 1,000 credits = 1.00¢/credit). Actual plan pricing can differ.'

export const getSupadataCreditRateCents = (): number => SUPADATA_REFERENCE_CREDIT_RATE_CENTS

export const estimateSupadataGenerateCredits = (durationSeconds: number): number =>
  (Math.max(0, durationSeconds) / 60) * SUPADATA_GENERATE_CREDITS_PER_MINUTE

export const estimateSupadataCredits = (
  model: string,
  durationSeconds: number
): number => {
  const generatedCredits = estimateSupadataGenerateCredits(durationSeconds)

  switch (model) {
    case 'native':
      return SUPADATA_NATIVE_TRANSCRIPT_CREDITS
    case 'generate':
      return generatedCredits
    case 'auto':
    default:
      return Math.max(SUPADATA_NATIVE_TRANSCRIPT_CREDITS, generatedCredits)
  }
}

export const convertSupadataCreditsToCents = (
  credits: number,
  creditRateCents = getSupadataCreditRateCents()
): number => Math.max(0, credits) * creditRateCents

export const estimateSupadataCost = (
  model: string,
  durationSeconds: number
): { credits: number, totalCost: number, note: string } => {
  const credits = estimateSupadataCredits(model, durationSeconds)
  return {
    credits,
    totalCost: convertSupadataCreditsToCents(credits),
    note: buildSupadataSttEstimateNote(model, durationSeconds)
  }
}

export const buildSupadataSttEstimateNote = (
  model: string,
  durationSeconds: number
): string => {
  const generatedCredits = estimateSupadataGenerateCredits(durationSeconds)
  const generatedCreditsLabel = formatApproximateCredits(generatedCredits)
  const durationMinutesLabel = formatDurationMinutes(durationSeconds)
  const referenceRate = 'Supadata Basic/Pro auto-recharge rate ($10 / 1,000 credits = 1.00¢/credit)'

  switch (model) {
    case 'native':
      return `Estimated at ${referenceRate}: 1 credit per request, including transcript-unavailable responses.`
    case 'generate':
      return `Estimated at ${referenceRate}: ${generatedCreditsLabel} credits (${durationMinutesLabel} min x 2 credits/min).`
    case 'auto':
    default:
      return `Estimated at ${referenceRate}: auto mode is priced conservatively as the higher of 1 credit for native transcript retrieval or ${generatedCreditsLabel} credits for AI generation (${durationMinutesLabel} min x 2 credits/min).`
  }
}

export const computeSupadataActualCost = (
  model: string,
  durationSeconds: number,
  billedCredits?: number | undefined,
  creditRateCents = getSupadataCreditRateCents()
): { creditsUsed: number, totalCost: number, source: 'response-header' | 'fallback-estimate' } => {
  const creditsUsed = typeof billedCredits === 'number' && Number.isFinite(billedCredits)
    ? Math.max(0, billedCredits)
    : estimateSupadataCredits(model, durationSeconds)

  return {
    creditsUsed,
    totalCost: convertSupadataCreditsToCents(creditsUsed, creditRateCents),
    source: typeof billedCredits === 'number' && Number.isFinite(billedCredits)
      ? 'response-header'
      : 'fallback-estimate'
  }
}
