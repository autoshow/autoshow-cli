export const formatSketchChunkTarget = (chunk: number): string => {
  return `chunk-${String(chunk).padStart(2, '0')}`
}
