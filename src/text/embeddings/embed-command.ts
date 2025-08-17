import { createEmbeds } from './create-embed.ts'
import { queryEmbeddings } from './query-embed.ts'
import { l, err } from '@/logging'
import type { EmbeddingOptions } from '@/types'
export async function processEmbedCommand(options: EmbeddingOptions): Promise<void> {
  const p = '[text/embeddings/embed-command]'
  l.dim(`${p} Processing embed command`)
  
  try {
    if (options.create) {
      const directory = typeof options.create === 'string' ? options.create : 'content'
      l.dim(`${p} Creating embeddings from directory: ${directory}`)
      await createEmbeds(directory)
    } else if (options.query) {
      const question = typeof options.query === 'string' ? options.query : ''
      if (!question) {
        throw new Error('Query text is required')
      }
      l.dim(`${p} Querying embeddings with: ${question}`)
      await queryEmbeddings(question)
    } else {
      throw new Error('Either --create or --query option is required')
    }
  } catch (error) {
    err(`${p} Error in embed command: ${(error as Error).message}`)
    throw error
  }
}