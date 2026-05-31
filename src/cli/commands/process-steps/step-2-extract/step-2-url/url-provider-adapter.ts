import type { HtmlArticleBackend } from '~/types'
import type { UrlArticleRunResult, UrlRequestOptions } from './url-utils'

type UrlArticleProviderCapability =
  | 'remote-html'
  | 'local-html'
  | 'main-content'
  | 'full-content'
  | 'selectors'
  | 'wait'
  | 'timeout'
  | 'geo'
  | 'locale'
  | 'structured-extraction'
  | 'screenshot'
  | 'batch'
  | 'crawl'
  | 'map'
  | 'search'
  | 'browser-actions'

export type UrlArticleRunOptions = UrlRequestOptions & {
  contentScope?: 'main' | 'full' | undefined
  includeSelectors?: string[] | undefined
  excludeSelectors?: string[] | undefined
  waitMs?: number | undefined
  geo?: {
    country?: string | undefined
    languages?: string[] | undefined
    locale?: string | undefined
  } | undefined
  structuredExtraction?: boolean | undefined
  screenshot?: boolean | undefined
  batch?: boolean | undefined
  crawl?: boolean | undefined
  map?: boolean | undefined
  search?: boolean | undefined
  browserActions?: unknown[] | undefined
}

export type UrlArticleProviderAdapter = {
  id: HtmlArticleBackend
  displayName: string
  capabilities: readonly UrlArticleProviderCapability[]
  run: (
    source: string,
    sourceUrl: string | undefined,
    options?: UrlArticleRunOptions
  ) => Promise<UrlArticleRunResult>
}

type CapabilityTarget = Pick<UrlArticleProviderAdapter, 'displayName' | 'capabilities'>

const hasValues = (values: string[] | undefined): boolean =>
  Array.isArray(values) && values.some(value => value.trim().length > 0)

const hasBrowserActions = (actions: unknown[] | undefined): boolean =>
  Array.isArray(actions) && actions.length > 0

const requiresCapability = (
  adapter: CapabilityTarget,
  capability: UrlArticleProviderCapability,
  optionName: string
): void => {
  if (!adapter.capabilities.includes(capability)) {
    throw new Error(`${adapter.displayName} does not support URL article option "${optionName}".`)
  }
}

export const assertUrlArticleOptionsSupported = (
  adapter: CapabilityTarget,
  options: UrlArticleRunOptions | undefined
): void => {
  if (!options) {
    return
  }

  if (options.contentScope === 'full') {
    requiresCapability(adapter, 'full-content', 'contentScope=full')
  }
  if (hasValues(options.includeSelectors) || hasValues(options.excludeSelectors)) {
    requiresCapability(adapter, 'selectors', 'selectors')
  }
  if (typeof options.waitMs === 'number') {
    requiresCapability(adapter, 'wait', 'waitMs')
  }
  if (typeof options.timeoutMs === 'number') {
    requiresCapability(adapter, 'timeout', 'timeoutMs')
  }
  if (options.geo?.country) {
    requiresCapability(adapter, 'geo', 'geo.country')
  }
  if (hasValues(options.geo?.languages) || options.geo?.locale) {
    requiresCapability(adapter, 'locale', 'geo.locale')
  }
  if (options.structuredExtraction === true) {
    requiresCapability(adapter, 'structured-extraction', 'structuredExtraction')
  }
  if (options.screenshot === true) {
    requiresCapability(adapter, 'screenshot', 'screenshot')
  }
  if (options.batch === true) {
    requiresCapability(adapter, 'batch', 'batch')
  }
  if (options.crawl === true) {
    requiresCapability(adapter, 'crawl', 'crawl')
  }
  if (options.map === true) {
    requiresCapability(adapter, 'map', 'map')
  }
  if (options.search === true) {
    requiresCapability(adapter, 'search', 'search')
  }
  if (hasBrowserActions(options.browserActions)) {
    requiresCapability(adapter, 'browser-actions', 'browserActions')
  }
}
