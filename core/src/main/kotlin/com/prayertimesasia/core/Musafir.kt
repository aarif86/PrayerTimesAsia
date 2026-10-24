package com.prayertimesasia.core

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
        val n = naming.names
        val four = "${n[Prayer.DHUHR]}, ${n[Prayer.ASR]} and ${n[Prayer.ISHA]}"
        val km = rules.thresholdKm.toInt()
        return when (status) {
            Status.Home -> "You're home" to "Pray in full. Travel concessions apply once you journey at least $km km."
            is Status.Nearby -> "Within $km km of home" to "That's short of the travel distance, so pray in full."
            is Status.Traveller ->
                if (rules.allowsJamak) {
                    "You are a musafir" to "You may shorten (qasar) $four to 2 rakaat, and combine (jamak) ${n[Prayer.DHUHR]} with ${n[Prayer.ASR]}, and ${n[Prayer.MAGHRIB]} with ${n[Prayer.ISHA]}."
                } else {
                    "You are a musafir" to "Shorten (qasr) $four to 2 rakaat. In the Hanafi school prayers are not combined outside Hajj."
                }
            is Status.Settled -> "Settled here" to
                "You've been here ${status.days} days. Staying longer than ${rules.maxStayDays} days ends the travel concession - pray in full."
        }
    }
}
