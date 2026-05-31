const SCRAPECREATORS_YOUTUBE_TRANSCRIPT_CREDITS = 1
const SCRAPECREATORS_FREELANCE_CREDIT_RATE_CENTS = 4_700 / 25_000

export const SCRAPECREATORS_STT_AGGREGATE_NOTE =
  'ScrapeCreators YouTube transcript estimates use the published Freelance reference rate ($47 / 25,000 credits = 0.188¢ per transcript request). Business pricing is lower ($497 / 500,000 credits = 0.0994¢/request) but is not the default estimator.'

export const getScrapeCreatorsCreditRateCents = (): number =>
  SCRAPECREATORS_FREELANCE_CREDIT_RATE_CENTS

export const estimateScrapeCreatorsCredits = (): number =>
  SCRAPECREATORS_YOUTUBE_TRANSCRIPT_CREDITS

export const convertScrapeCreatorsCreditsToCents = (
  credits: number,
  creditRateCents = getScrapeCreatorsCreditRateCents()
): number => Math.max(0, credits) * creditRateCents

export const estimateScrapeCreatorsCost = (): { credits: number, totalCost: number, note: string } => {
  const credits = estimateScrapeCreatorsCredits()
  return {
    credits,
    totalCost: convertScrapeCreatorsCreditsToCents(credits),
    note: SCRAPECREATORS_STT_AGGREGATE_NOTE
  }
}

export const computeScrapeCreatorsActualCost = (
  billedCredits?: number | undefined,
  creditRateCents = getScrapeCreatorsCreditRateCents()
): { creditsUsed: number, totalCost: number, source: 'fallback-estimate' } => {
  const creditsUsed = typeof billedCredits === 'number' && Number.isFinite(billedCredits)
    ? Math.max(0, billedCredits)
    : estimateScrapeCreatorsCredits()

  return {
    creditsUsed,
    totalCost: convertScrapeCreatorsCreditsToCents(creditsUsed, creditRateCents),
    source: 'fallback-estimate'
  }
}
