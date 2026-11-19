import type { CalendarDataset } from './calendarSanad'
import bundled from '../../../data/calendar.json'

/**
 * data/calendar.json as it was when this build was made, so the published
 * Hijri calendars (MUIS month starts) work offline and on first open. A newer
 * download replaces it; parts a download leaves empty keep these.
 */
export const BUNDLED_CALENDAR = bundled as CalendarDataset

export function withBundled(c: CalendarDataset | null | undefined): CalendarDataset {
  if (!c?.announcements) return BUNDLED_CALENDAR
  return {
    ...c,
    announcements: c.announcements.length ? c.announcements : BUNDLED_CALENDAR.announcements,
    month_starts: c.month_starts?.length ? c.month_starts : BUNDLED_CALENDAR.month_starts,
  }
}
