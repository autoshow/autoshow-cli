import { l, err } from '@/logging'
import type { VectorizeVector } from '@/types'

const MAX_METADATA_BYTES = 10240

export function validateMetadataSize(metadata: Record<string, any>, vectorId: string): boolean {
  const p = '[text/embeddings/upload-vectorize]'
  
  const metadataJson = JSON.stringify(metadata)
  const metadataBytes = new TextEncoder().encode(metadataJson).length
  
  l.dim(`${p} Vector ${vectorId} metadata size: ${metadataBytes} bytes`)
  
  if (metadataBytes > MAX_METADATA_BYTES) {
    err(`${p} Metadata for vector ${vectorId} exceeds ${MAX_METADATA_BYTES} bytes: ${metadataBytes} bytes`)
    return false
  }
  
  return true
}

export async function uploadToVectorize(vectors: VectorizeVector[], accountId: string, apiToken: string, indexName: string): Promise<void> {
  const p = '[text/embeddings/upload-vectorize]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/upsert`
  
  l.dim(`${p} Uploading ${vectors.length} vectors to Vectorize index: ${indexName}`)
  
  for (const vector of vectors) {
    if (!validateMetadataSize(vector.metadata || {}, vector.id)) {
      throw new Error(`Vector ${vector.id} metadata exceeds size limit. Consider reducing content size or implementing chunking.`)
    }
  }
  
  const ndjsonContent = vectors.map(v => JSON.stringify(v)).join('\n')
  
  l.dim(`${p} Upload payload size: ${new TextEncoder().encode(ndjsonContent).length} bytes`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/x-ndjson'
    },
    body: ndjsonContent
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        const errorMsg = errorData.errors[0].message
        if (errorMsg.includes('oversized metadata')) {
          throw new Error(`Vectorize metadata size error: ${errorMsg}\n\nThis usually means the content is too large. Try processing smaller files or implementing document chunking.`)
        }
        throw new Error(`Vectorize upload error: ${errorMsg}`)
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Vectorize metadata size error')) {
        throw e
      }
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Vectorize upload API error: ${response.status} - ${errorText}`)
  }
  
  const responseData = await response.json() as { 
    result?: { mutationId?: string },
    success?: boolean 
  }
  
  if (responseData.result?.mutationId) {
    l.dim(`${p} Upload completed with mutation ID: ${responseData.result.mutationId}`)
  }
  
  l.success(`Successfully uploaded ${vectors.length} vectors to Vectorize`)
  
  l.dim(`${p} Waiting for vectors to be indexed...`)
  await new Promise(resolve => setTimeout(resolve, 5000))
}