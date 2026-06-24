const KA = Math.LN2 / 1.5   // 0.462 día⁻¹ — absorción desde depósito IM (Tmax ~2.7d)
const KE = Math.LN2 / 4.5   // 0.154 día⁻¹ — eliminación (t½ = 4.5d, enantato)

export interface InjectionPoint {
  date: string    // 'YYYY-MM-DD'
  mgDose: number  // miligramos de testosterona base
}

function batemanAt(dt: number, dose: number): number {
  if (dt <= 0) return 0
  return dose * KA / (KA - KE) * (Math.exp(-KE * dt) - Math.exp(-KA * dt))
}

function buildNormalizedCurve(
  injPoints: Array<{ t: number; dose: number }>,
  totalDays: number,
  resolution: number,
): Array<{ t: number; level: number }> {
  const n = Math.ceil(totalDays * resolution) + 1
  const raw = Array.from({ length: n }, (_, i) => {
    const t = i / resolution
    return { t, level: injPoints.reduce((s, p) => s + batemanAt(t - p.t, p.dose), 0) }
  })
  const peak = Math.max(...raw.map(r => r.level), 0)
  if (peak === 0) return raw.map(r => ({ t: r.t, level: 0 }))
  return raw.map(r => ({ t: r.t, level: Math.round(r.level / peak * 1000) / 10 }))
}

function dateToOffsetDays(origin: string, date: string): number {
  return Math.round(
    (new Date(date + 'T00:00:00').getTime() - new Date(origin + 'T00:00:00').getTime()) / 86400000
  )
}

/**
 * Calcula la curva PK de T a partir de inyecciones reales.
 * El eje Y está normalizado al 100% en el pico global.
 * @param injections  Lista de inyecciones con fecha y dosis en mg.
 * @param totalDays   Días a calcular desde la primera inyección.
 * @param resolution  Puntos por día (default 4).
 */
export function computePKCurve(
  injections: InjectionPoint[],
  totalDays: number,
  resolution = 4,
): Array<{ t: number; level: number }> {
  if (injections.length === 0) return []
  const sorted = [...injections].sort((a, b) => a.date.localeCompare(b.date))
  const origin = sorted[0].date
  const injPoints = sorted.map(inj => ({
    t: dateToOffsetDays(origin, inj.date),
    dose: inj.mgDose,
  }))
  return buildNormalizedCurve(injPoints, totalDays, resolution)
}

/**
 * Genera una curva de steady-state hipotética para un protocolo.
 * Útil para el comparador de protocolos (no usa fechas reales).
 * @param intervalDays  Días entre inyecciones (3.5 = 2x/semana, 7 = semanal, 14 = quincenal).
 * @param mgDose        Dosis por inyección en mg.
 * @param cycles        Número de ciclos a simular (default 10 para alcanzar steady-state).
 */
export function generateSteadyState(
  intervalDays: number,
  mgDose: number,
  cycles = 10,
): Array<{ t: number; level: number }> {
  const injPoints = Array.from({ length: cycles }, (_, i) => ({
    t: i * intervalDays,
    dose: mgDose,
  }))
  return buildNormalizedCurve(injPoints, intervalDays * cycles, 4)
}

/**
 * Detecta los intervalos donde la curva cae por debajo del umbral.
 * Estos son los momentos sugeridos para reinjectar.
 * @param curve      Output de computePKCurve o generateSteadyState.
 * @param threshold  Nivel mínimo aceptable (default 30%). Configurable en el futuro.
 *
 * FUTURE (Opción C): Extender computePKCurve con forecastDays para proyectar la
 * curva hacia adelante desde hoy, y usar findReinjectionWindows para sugerir la
 * próxima fecha de inyección.
 */
export function findReinjectionWindows(
  curve: Array<{ t: number; level: number }>,
  threshold = 30,
): Array<{ tStart: number; tEnd: number }> {
  const windows: Array<{ tStart: number; tEnd: number }> = []
  let inWindow = false
  let tStart = 0
  for (const pt of curve) {
    if (!inWindow && pt.level <= threshold) { inWindow = true; tStart = pt.t }
    else if (inWindow && pt.level > threshold) { windows.push({ tStart, tEnd: pt.t }); inWindow = false }
  }
  if (inWindow) windows.push({ tStart, tEnd: curve[curve.length - 1].t })
  return windows
}
