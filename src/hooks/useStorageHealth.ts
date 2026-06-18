import { useState, useEffect } from 'react'
import { read } from '../storage/persistence'
import { computeChecksum } from '../storage/checksum'

export function useStorageHealth() {
  const [healthy, setHealthy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const check = () => {
      try {
        const schema = read()
        const expected = computeChecksum({ supplements: schema.supplements, dailyLogs: schema.dailyLogs })
        if (schema._checksum !== expected) {
          setHealthy(false)
          setError('Checksum mismatch — posible corrupción de datos')
        } else {
          setHealthy(true)
          setError(null)
        }
      } catch (e) {
        setHealthy(false)
        setError(e instanceof Error ? e.message : 'Error desconocido')
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  return { healthy, error }
}
