export const getHuggingFaceToken = (): string | undefined => {
  const token = process.env['HUGGINGFACE_TOKEN']
  return token && token.trim().length > 0 ? token.trim() : undefined
}
