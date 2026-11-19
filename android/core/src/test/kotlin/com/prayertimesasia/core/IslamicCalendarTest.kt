package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** The month calendar follows MUIS's published Islamic calendar. Same cases as web/tests/publishedHijri.test.ts. */
class IslamicCalendarTest {
    private val data = BundledCalendar.dataset

    private fun hijri(y: Int, m: Int, d: Int, authority: String? = "MUIS") =
        Season.communityHijri(LocalDate.of(y, m, d), 0, data.announcements, authority, data.monthStarts)

    @Test fun bundledCopyHasMuisMonthStarts() {
        assertTrue(data.monthStarts.size >= 24)
        assertTrue(data.announcements.isNotEmpty())
    }

    @Test fun followsMuisCalendar() {
        assertEquals(Hijri.HijriDate(1, 10, 1448), hijri(2027, 3, 10))
        assertEquals(Hijri.HijriDate(10, 12, 1448), hijri(2027, 5, 17))
        assertEquals(Hijri.HijriDate(27, 7, 1448), hijri(2027, 1, 6))
        assertEquals(Hijri.HijriDate(12, 3, 1449), hijri(2027, 8, 15))
    }

    @Test fun otherAuthoritiesAndLaterDatesKeepTheEstimate() {
        assertNull(Season.publishedHijri(LocalDate.of(2027, 5, 17), data.monthStarts, "JAKIM"))
        assertNull(Season.publishedHijri(LocalDate.of(2028, 6, 1), data.monthStarts, "MUIS"))
    }

    @Test fun downloadedCopyWithoutMonthStartsIsFilledIn() {
        val fresh = CalendarDataset(1, "CC-BY-4.0", data.announcements)
        assertEquals(data.monthStarts, fresh.withBundled().monthStarts)
    }

    @Test fun keyDays() {
        assertEquals(listOf(IslamicDayKind.AIDILADHA), IslamicDays.of(Hijri.HijriDate(10, 12, 1448)).map { it.kind })
        assertEquals(listOf(IslamicDayKind.TASYRIK), IslamicDays.of(Hijri.HijriDate(13, 12, 1448)).map { it.kind })
        assertEquals(listOf(IslamicDayKind.WHITE_DAY), IslamicDays.of(Hijri.HijriDate(14, 5, 1448)).map { it.kind })
        assertTrue(IslamicDays.of(Hijri.HijriDate(14, 9, 1448)).isEmpty())
        assertEquals("Hari Raya Aidilfitri", IslamicDays.name(IslamicDayKind.AIDILFITRI, NamingStyle.MALAY))
        assertEquals("Jumada II", IslamicDays.monthShort(6, NamingStyle.INTERNATIONAL))
    }
}
