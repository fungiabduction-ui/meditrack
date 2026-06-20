export const MASS_UNITS = new Set<string>(['mg', 'g', 'mcg'])

/**
 * Calcula la cantidad total de un ingrediente activo para un log entry.
 *
 * Si el ingrediente se mide en la misma unidad de masa que el doseUnit,
 * el ingrediente ES la dosis — quantity es el total directo.
 * En todos los demás casos se aplica amount × quantity.
 */
export function calcIngAmount(
  ingAmount: number,
  ingUnit: string,
  doseUnit: string,
  quantity: number
): number {
  if (MASS_UNITS.has(ingUnit) && ingUnit === doseUnit) return quantity
  return ingAmount * quantity
}
