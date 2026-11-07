package com.prayertimesasia.core

import kotlin.math.roundToInt

/**
 * Traveller's concessions (rukhsah): shortening (qasar) and combining (jamak).
 *
 * This is guidance, not a fatwa - the UI always says so and points to the
 * traveller's own religious authority. The thresholds are the commonly cited
 * figures: two marhalah, about 81 km in the Shafi'i school followed across
 * Southeast Asia (some authorities use about 89 km), about 78 km in the Hanafi school.
 */
object Musafir {
    data class Rules(val school: AsrSchool, val thresholdKm: Double) {
        /** Days of intended stay after which you are no longer a traveller. */
        val maxStayDays: Int get() = if (school == AsrSchool.HANAFI) 15 else 3
        val allowsJamak: Boolean get() = school != AsrSchool.HANAFI
    }

    sealed class Status {
        data object Home : Status()
        data class Nearby(val distanceKm: Double) : Status()
        data class Traveller(val distanceKm: Double) : Status()
        data class Settled(val distanceKm: Double, val days: Int) : Status()

        val isTraveller: Boolean get() = this is Traveller

        val distance: Double?
            get() = when (this) {
                Home -> null
                is Nearby -> distanceKm
                is Traveller -> distanceKm
                is Settled -> distanceKm
            }
    }

    /** [daysHere] counts full days since arriving at the current destination. */
    fun status(home: Coordinates?, current: Coordinates, daysHere: Int, rules: Rules): Status? {
        if (home == null) return null
        val km = Geo.distanceKm(home, current)
        if (km < 2) return Status.Home
        if (km < rules.thresholdKm) return Status.Nearby(km)
        if (daysHere > rules.maxStayDays) return Status.Settled(km, daysHere)
        return Status.Traveller(km)
    }

    fun guidance(status: Status, rules: Rules, naming: NamingStyle): Pair<String, String> {
        val km = rules.thresholdKm.toInt()
        return when (status) {
            Status.Home -> "You're home" to "Pray in full. Travel concessions apply once you journey at least $km km."
            is Status.Nearby -> "Within $km km of home" to "That's short of the travel distance, so pray in full."
            is Status.Traveller ->
                if (rules.allowsJamak) {
                    "You are a musafir" to "You may shorten (qasar) and join (jamak) your prayers. Here is what changes for each one."
                } else {
                    "You are a musafir" to "You may shorten (qasr) your prayers. In the Hanafi school prayers are not joined outside Hajj. Here is what changes for each one."
                }
            is Status.Settled -> "Settled here" to
                "You've been here ${status.days} days. Staying longer than ${rules.maxStayDays} days ends the travel concession, so pray in full."
        }
    }

    /**
     * One prayer's line in the traveller's plan, so nobody has to work out
     * from a sentence which prayers are shortened and which are joined.
     */
    data class PlanRow(val prayer: Prayer, val name: String, val rakaat: String, val change: String, val join: String)

    /** Subuh and Maghrib keep their rakaat; Zohor, Asar and Isyak go from 4 to 2. Zohor joins Asar, Maghrib joins Isyak (not Hanafi). */
    fun plan(rules: Rules, naming: NamingStyle): List<PlanRow> {
        val n = (if (naming.isRightToLeft) NamingStyle.INTERNATIONAL else naming).names
        fun join(p: Prayer): String {
            if (!rules.allowsJamak) return "Not joined"
            return when (p) {
                Prayer.DHUHR -> "Can join with ${n[Prayer.ASR]}"
                Prayer.ASR -> "Can join with ${n[Prayer.DHUHR]}"
                Prayer.MAGHRIB -> "Can join with ${n[Prayer.ISHA]}"
                Prayer.ISHA -> "Can join with ${n[Prayer.MAGHRIB]}"
                else -> "Never joined"
            }
        }
        val shortened = "Shortened from 4"
        return listOf(
            PlanRow(Prayer.FAJR, n[Prayer.FAJR]!!, "2 rakaat", "No change", join(Prayer.FAJR)),
            PlanRow(Prayer.DHUHR, n[Prayer.DHUHR]!!, "2 rakaat", shortened, join(Prayer.DHUHR)),
            PlanRow(Prayer.ASR, n[Prayer.ASR]!!, "2 rakaat", shortened, join(Prayer.ASR)),
            PlanRow(Prayer.MAGHRIB, n[Prayer.MAGHRIB]!!, "3 rakaat", "No change", join(Prayer.MAGHRIB)),
            PlanRow(Prayer.ISHA, n[Prayer.ISHA]!!, "2 rakaat", shortened, join(Prayer.ISHA)),
        )
    }

    /** Plain words on how the chosen travel distance decides the result, so switching 81 km and 89 km visibly does something. */
    fun distanceCheck(status: Status, rules: Rules): Pair<Boolean, String>? {
        val limit = rules.thresholdKm.toInt()
        return when (status) {
            Status.Home -> null
            is Status.Nearby -> false to "You are ${"%,d".format(java.util.Locale.US, status.distanceKm.roundToInt())} km from home. That is less than $limit km, so this trip does not count as travel yet."
            is Status.Traveller -> true to "You are ${"%,d".format(java.util.Locale.US, status.distanceKm.roundToInt())} km from home. That is more than $limit km, so this trip counts as travel."
            is Status.Settled -> true to "You are ${"%,d".format(java.util.Locale.US, status.distanceKm.roundToInt())} km from home. That is more than $limit km, so this trip counts as travel."
        }
    }
}
