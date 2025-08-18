import { env } from '@/node-utils'
import { l, err } from '@/logging'
import type { VectorizeIndexConfig, VectorizeIndexInfo } from '@/types'

export async function checkIndexExists(indexName: string): Promise<boolean> {
  const p = '[embeddings/vectorize-setup]'
  
  const accountId = env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = env['CLOUDFLARE_API_TOKEN']
  
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
  }
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.status === 404) {
      return false
    } else if (response.ok) {
      return true
    } else {
      const errorText = await response.text()
      throw new Error(`Failed to check index: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    err(`${p} Error checking index existence: ${error}`)
    throw error
  }
}

export async function createVectorizeIndex(indexName: string, dimensions: number = 1024): Promise<void> {
  const p = '[embeddings/vectorize-setup]'
  
  const accountId = env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = env['CLOUDFLARE_API_TOKEN']
  
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
  }
  
  const indexConfig: VectorizeIndexConfig = {
    name: indexName,
    description: `Embeddings index created by AutoShow CLI using bge-m3 model`,
    config: {
      dimensions,
      metric: 'cosine'
    }
  }
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(indexConfig)
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
        if (errorData.errors?.[0]?.message) {
          throw new Error(`Failed to create index: ${errorData.errors[0].message}`)
        }
      } catch (e) {
        l.dim(`${p} Failed to parse error response`)
      }
      throw new Error(`Failed to create index: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json() as { result: VectorizeIndexInfo }
    l.success(`Index '${data.result.name}' created successfully`)
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
  } catch (error) {
    err(`${p} Error creating index: ${error}`)
    throw error
  }
}

export async function ensureVectorizeIndex(indexName: string, dimensions: number = 1024): Promise<void> {
  const p = '[embeddings/vectorize-setup]'
  
  try {
    const exists = await checkIndexExists(indexName)
    
    if (!exists) {
      await createVectorizeIndex(indexName, dimensions)
    }
  } catch (error) {
    err(`${p} Error ensuring index exists: ${error}`)
    throw error
  }
}