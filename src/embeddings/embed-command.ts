import { createEmbeds } from './create/create-embed.ts'
import { queryEmbeddings } from './query/query-embed.ts'
import { err } from '@/logging'
import type { EmbeddingOptions } from '@/types'

export async function processEmbedCommand(options: EmbeddingOptions): Promise<void> {
  const p = '[embeddings/embed-command]'
  
  try {
    if (options.create) {
      const directory = typeof options.create === 'string' ? options.create : 'content'
      await createEmbeds(directory)
    } else if (options.query) {
      const question = typeof options.query === 'string' ? options.query : ''
      if (!question) {
        throw new Error('Query text is required')
      }
      await queryEmbeddings(question)
    } else {
      throw new Error('Either --create or --query option is required')
    }
  } catch (error) {
    err(`${p} Error in embed command: ${(error as Error).message}`)
    throw error
  }
}