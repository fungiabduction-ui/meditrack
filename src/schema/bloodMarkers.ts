import type { BloodMarker } from './types'

export type BloodMarkerMeta = {
  label: string
  unit: string
  refMin?: number
  refMax?: number
}

export const BLOOD_MARKER_META: Record<BloodMarker, BloodMarkerMeta> = {
  tTotal:      { label: 'Testosterona Total', unit: 'ng/dL',  refMin: 300, refMax: 1000 },
  tLibre:      { label: 'Testosterona Libre', unit: 'pg/mL' },
  e2:          { label: 'Estradiol (E2)',      unit: 'pg/mL', refMin: 10,  refMax: 40 },
  shbg:        { label: 'SHBG',               unit: 'nmol/L' },
  lh:          { label: 'LH',                 unit: 'mIU/mL' },
  fsh:         { label: 'FSH',                unit: 'mIU/mL' },
  hematocrito: { label: 'Hematocrito',        unit: '%',     refMin: 38,  refMax: 50 },
  psa:         { label: 'PSA',                unit: 'ng/mL',              refMax: 4 },
  prolactina:  { label: 'Prolactina',         unit: 'ng/mL',              refMax: 20 },
}

export const BLOOD_MARKER_ORDER: BloodMarker[] = [
  'tTotal', 'tLibre', 'e2', 'shbg', 'lh', 'fsh', 'hematocrito', 'psa', 'prolactina',
]
