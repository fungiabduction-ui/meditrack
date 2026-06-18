// FNV-1a 32-bit hash — síncrono, sin dependencias
export function computeChecksum(data: unknown): string {
  const str = JSON.stringify(data)
  let hash = 2_166_136_261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
