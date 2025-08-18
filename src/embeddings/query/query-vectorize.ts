import { l } from '@/logging'
import type { VectorizeMatch } from '@/types'

export async function queryVectorize(
  queryVector: number[],
  accountId: string,
  apiToken: string,
  indexName: string,
  topK: number = 5
): Promise<VectorizeMatch[]> {
  const p = '[embeddings/query/query-vectorize]'
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/query`
  
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
  
  return matches
}