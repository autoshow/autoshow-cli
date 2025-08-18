export interface VectorizeVector {
  id: string
  values: number[]
  metadata?: Record<string, any>
}

export interface VectorizeMatch {
  id: string
  score: number
  metadata?: Record<string, any>
}

export interface EmbeddingOptions {
  create?: boolean | string
  query?: string
}

export interface VectorizeIndexConfig {
  name: string
  description: string
  config: {
    dimensions: number
    metric: string
  }
}

export interface VectorizeIndexInfo {
  name: string
  description: string
  config: {
    dimensions: number
    metric: string
  }
  created_on: string
  modified_on: string
}