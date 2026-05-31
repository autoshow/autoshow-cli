import type { PageResult } from '~/types'

type HostedOcrPagePayload = {
  pageNumber: number
  text: string
}

type NormalizeHostedOcrPagesOptions = {
  emptyPagesMessage?: string | undefined
  countMismatchMessage: (actualPageCount: number, expectedPageCount: number) => string
  nonContiguousMessage: string
}

export const buildHostedOcrJsonPrompt = (expectedPageCount: number): string => [
  'Perform OCR on the provided document or image.',
  'Return only JSON.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If a page is blank or unreadable, return that page with an empty string for text.',
  `Return exactly ${expectedPageCount} page objects with contiguous pageNumber values from 1 through ${expectedPageCount}.`
].join(' ')

export const normalizeHostedOcrPages = (
  value: readonly HostedOcrPagePayload[],
  expectedPageCount: number,
  options: NormalizeHostedOcrPagesOptions
): PageResult[] => {
  const pages = value
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => ({
      pageNumber: page.pageNumber,
      method: 'ocr' as const,
      text: page.text
    }))

  if (pages.length === 0 && options.emptyPagesMessage) {
    throw new Error(options.emptyPagesMessage)
  }

  if (pages.length !== expectedPageCount) {
    throw new Error(options.countMismatchMessage(pages.length, expectedPageCount))
  }

  for (let i = 0; i < pages.length; i++) {
    const expectedPageNumber = i + 1
    if (pages[i]?.pageNumber !== expectedPageNumber) {
      throw new Error(options.nonContiguousMessage)
    }
  }

  return pages
}
