import { env } from '@/node-utils'
import { l, err } from '@/logging'
import { checkIndexExists } from '../utils/vectorize-setup.ts'
import type { VectorizeMatch } from '@/types'

async function embedText(text: string, accountId: string, apiToken: string): Promise<number[]> {
  const p = '[text/embeddings/query-embed]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`
  
  l.dim(`${p} Creating embedding for query text using bge-m3`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        throw new Error(`Workers AI embedding error: ${errorData.errors[0].message}`)
      }
    } catch (e) {
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Workers AI embedding API error: ${response.status} - ${errorText}`)
  }
  
  const json = await response.json() as { 
    result?: { 
      data?: number[][],
      shape?: number[] 
    },
    success?: boolean,
    errors?: Array<{ message: string }>
  }
  
  l.dim(`${p} Embedding API response received`)
  
  if (!json.success || !json.result?.data?.[0]) {
    const errorMsg = json.errors?.[0]?.message || 'Unknown embedding error'
    throw new Error(`Workers AI embedding failed: ${errorMsg}`)
  }
  
  return json.result.data[0]
}

async function queryVectorize(
  queryVector: number[],
  accountId: string,
  apiToken: string,
  indexName: string,
  topK: number = 5
): Promise<VectorizeMatch[]> {
  const p = '[text/embeddings/query-embed]'
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/query`
  
  l.dim(`${p} Querying Vectorize index: ${indexName} with topK: ${topK}`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vector: queryVector,
      topK,
      returnValues: false,
      returnMetadata: 'all'
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        throw new Error(`Vectorize query error: ${errorData.errors[0].message}`)
      }
    } catch (e) {
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Vectorize query API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json() as { 
    result?: { matches?: VectorizeMatch[] },
    success?: boolean 
  }
  
  const matches = data.result?.matches || []
  l.dim(`${p} Found ${matches.length} matches from Vectorize`)
  
  return matches
}

async function callChatCompletion(userQuestion: string, context: string, accountId: string, apiToken: string): Promise<string> {
  const p = '[text/embeddings/query-embed]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/responses`
  
  const prompt = `You are a helpful assistant. Use the provided context to answer questions accurately.

Context:
${context}

Question: ${userQuestion}`
  
  l.dim(`${p} Calling gpt-oss-120b via /ai/v1/responses endpoint`)
  l.dim(`${p} Prompt length: ${prompt.length} characters`)
  
  const requestBody = {
    model: '@cf/openai/gpt-oss-120b',
    input: prompt
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  
  l.dim(`${p} Chat completion API response status: ${response.status}`)
  
  if (!response.ok) {
    const errorText = await response.text()
    l.dim(`${p} Error response: ${errorText}`)
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        throw new Error(`Workers AI chat completion error: ${errorData.errors[0].message}`)
      }
    } catch (e) {
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Workers AI chat completion API error: ${response.status} - ${errorText}`)
  }
  
  const responseText = await response.text()
  l.dim(`${p} Raw response received, length: ${responseText.length}`)
  
  let json: any
  try {
    json = JSON.parse(responseText)
    l.dim(`${p} Response JSON parsed successfully`)
  } catch (e) {
    l.dim(`${p} Failed to parse JSON response: ${responseText.substring(0, 200)}...`)
    throw new Error(`Invalid JSON response from Workers AI: ${responseText.substring(0, 100)}`)
  }
  
  l.dim(`${p} Response structure: ${JSON.stringify(Object.keys(json), null, 2)}`)
  
  if (json.success === false) {
    const errorMsg = json.errors?.[0]?.message || 'Unknown error'
    throw new Error(`Workers AI chat completion failed: ${errorMsg}`)
  }
  
  let responseContent: string | undefined
  
  if (json.result) {
    l.dim(`${p} Found result object, keys: ${JSON.stringify(Object.keys(json.result), null, 2)}`)
    responseContent = json.result.response || json.result.output || json.result.text || json.result.content
  }
  
  if (!responseContent && typeof json === 'string') {
    l.dim(`${p} Response appears to be a direct string`)
    responseContent = json
  }
  
  if (!responseContent && json.output) {
    l.dim(`${p} Found output field at root level`)
    responseContent = json.output
  }
  
  if (!responseContent) {
    l.dim(`${p} Could not extract response content. Full response: ${JSON.stringify(json, null, 2)}`)
    throw new Error(`No response content found in Workers AI response. Response keys: ${Object.keys(json).join(', ')}`)
  }
  
  l.dim(`${p} Successfully extracted response content, length: ${responseContent.length}`)
  return responseContent
}

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
      const content = match.metadata?.['content'] || ''
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