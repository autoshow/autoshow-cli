import type { HtmlArticleBackend } from '~/types'
import { defuddleArticleAdapter } from './url-local/defuddle/run-defuddle-url'
import { firecrawlArticleAdapter } from './url-services/firecrawl/run-firecrawl-url'
import { glmReaderArticleAdapter } from './url-services/glm-reader/run-glm-reader-url'
import { spiderArticleAdapter } from './url-services/spider/run-spider-url'
import { zyteArticleAdapter } from './url-services/zyte/run-zyte-url'
import type { UrlArticleProviderAdapter, UrlArticleRunOptions } from './url-provider-adapter'
import type { UrlArticleRunResult } from './url-utils'

export const URL_ARTICLE_PROVIDER_ADAPTERS: Record<HtmlArticleBackend, UrlArticleProviderAdapter> = {
  defuddle: defuddleArticleAdapter,
  firecrawl: firecrawlArticleAdapter,
  'glm-reader': glmReaderArticleAdapter,
  spider: spiderArticleAdapter,
  zyte: zyteArticleAdapter
}

export const getUrlArticleProviderAdapter = (
  backend: HtmlArticleBackend
): UrlArticleProviderAdapter => URL_ARTICLE_PROVIDER_ADAPTERS[backend]

export const runUrlArticleProvider = async (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> =>
  await getUrlArticleProviderAdapter(backend).run(source, sourceUrl, options)
