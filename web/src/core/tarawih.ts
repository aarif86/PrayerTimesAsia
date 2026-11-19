/**
 * The Tarawih counter. The user chooses 8 or 20 rakaat once (both are followed,
 * the app never says which), then taps after each salam. Each tap is 2 rakaat.
 * Same rules as ios Core/Tarawih.swift and android core Tarawih.kt.
 */
export const TARAWIH_RAKAAT = [8, 20] as const
export type TarawihRakaat = (typeof TARAWIH_RAKAAT)[number]

/** One salam: two more rakaat, never past the total. */
export function tarawihTap(done: number, total: TarawihRakaat): number {
  return Math.min(total, Math.max(0, done) + 2)
}

/** Take back the last salam. */
export function tarawihUndo(done: number): number {
  return Math.max(0, done - 2)
}

/** How many salam of the total have been tapped, for the row of dots. */
export function tarawihSets(total: TarawihRakaat): number {
  return total / 2
}
