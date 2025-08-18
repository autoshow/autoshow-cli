import { env } from '@/node-utils'
import { l, err } from '@/logging'
import { checkIndexExists } from '../vectorize-setup.ts'
import { embedText } from './embed-text.ts'
import { queryVectorize } from './query-vectorize.ts'
import { callChatCompletion } from './chat-completion.ts'

export async function queryEmbeddings(question: string): Promise<void> {
  const p = '[text/embeddings/query-embed]'
  l.step(`\nQuerying Embeddings\n`)
  
  if (!question) {
    throw new Error('No question provided.')
  }
  
  const cloudflareAccountId = env['CLOUDFLARE_ACCOUNT_ID']
  if (!cloudflareAccountId) {
    throw new Error('Please set the CLOUDFLARE_ACCOUNT_ID environment variable.')
  }
  
  const cloudflareApiToken = env['CLOUDFLARE_API_TOKEN']
  if (!cloudflareApiToken) {
    throw new Error('Please set the CLOUDFLARE_API_TOKEN environment variable.')
  }
  
  const indexName = env['VECTORIZE_INDEX_NAME'] || 'autoshow-embeddings'
  l.dim(`${p} Using Vectorize index: ${indexName}`)
  l.dim(`${p} Using Workers AI models: bge-m3 for embeddings, gpt-oss-120b for generation`)
  
  try {
    l.dim(`${p} Checking if Vectorize index exists`)
    const indexExists = await checkIndexExists(indexName)
    if (!indexExists) {
      throw new Error(`Vectorize index '${indexName}' does not exist. Please create embeddings first using: npm run as -- text embed --create`)
    }
    
    l.dim(`${p} Creating embedding for query: "${question}"`)
    const queryEmbedding = await embedText(question, cloudflareAccountId, cloudflareApiToken)
    
    l.dim(`${p} Searching for similar vectors...`)
    const matches = await queryVectorize(
      queryEmbedding,
      cloudflareAccountId,
      cloudflareApiToken,
      indexName,
      5
    )
    
    if (matches.length === 0) {
      l.warn('No matches found in the database.')
      l.warn('The index might be empty. Try creating embeddings first.')
      return
    }
    
    l.success(`Found ${matches.length} matches`)
    
    const matchTable = matches.map(m => ({
      filename: m.metadata?.['filename'] || 'Unknown',
      score: m.score.toFixed(4)
    }))
    
    console.table(matchTable)
    
    let combinedContent = ''
    matches.forEach(match => {
      const filename = match.metadata?.['filename'] || 'Unknown'
      const content = match.metadata?.['input'] || ''
      combinedContent += `\n\n---\n**File: ${filename}**\n${content}\n`
    })
    
    l.dim(`${p} Generated context length: ${combinedContent.length} characters`)
    l.dim(`${p} Generating answer using context...`)
    
    try {
      const answer = await callChatCompletion(question, combinedContent, cloudflareAccountId, cloudflareApiToken)
      
      l.success('\nAnswer:')
      console.log(JSON.stringify(answer, null, 2))
    } catch (chatError) {
      err(`${p} Chat completion failed: ${chatError}`)
      l.warn('\nFalling back to showing retrieved context without AI generation:')
      l.success('\nRetrieved Context:')
      console.log(combinedContent)
      throw chatError
    }
    
  } catch (error) {
    err(`${p} Error querying embeddings: ${error}`)
    
    if (error instanceof Error && error.message.includes('does not exist')) {
      err('\nTo create embeddings, run:')
      err('npm run as -- text embed --create [directory]')
    } else if (error instanceof Error && error.message.includes('CLOUDFLARE_')) {
      err('\nPlease check your Cloudflare configuration:')
      err('1. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env')
      err('2. Test your token: npm run as -- text cloudflare test-token')
      err('3. Create a token if needed: npm run as -- text cloudflare create-vectorize-token')
    } else if (error instanceof Error && error.message.includes('Workers AI')) {
      err('\nWorkers AI error occurred. This might be due to:')
      err('1. Model availability - gpt-oss-120b might not be available in your region')
      err('2. API quota limits - check your Cloudflare dashboard')
      err('3. Input length - the context might be too long for the model')
      err('4. Model format changes - the API response format may have changed')
    }
    
    throw error
  }
}