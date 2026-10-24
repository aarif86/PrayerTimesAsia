package com.prayertimesasia.core

import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

object Geo {
    val kaaba = Coordinates(21.422487, 39.826206)
    const val EARTH_RADIUS_KM = 6371.0088

    /** Initial great-circle bearing from [from] to the Kaaba, degrees clockwise from true north. */
    fun qiblaBearing(from: Coordinates): Double = bearing(from, kaaba)

    fun bearing(a: Coordinates, b: Coordinates): Double {
        val p1 = Math.toRadians(a.latitude)
        val p2 = Math.toRadians(b.latitude)
        val dl = Math.toRadians(b.longitude - a.longitude)
        val y = sin(dl) * cos(p2)
        val x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)
        return Astro.fix(Math.toDegrees(atan2(y, x)), 360.0)
    }

    /** Haversine distance in kilometres. */
    fun distanceKm(a: Coordinates, b: Coordinates): Double {
        val p1 = Math.toRadians(a.latitude)
        val p2 = Math.toRadians(b.latitude)
        val dp = p2 - p1
        val dl = Math.toRadians(b.longitude - a.longitude)
        val h = sin(dp / 2) * sin(dp / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2)
        return 2 * EARTH_RADIUS_KM * asin(min(1.0, sqrt(h)))
    }

    private val points = listOf("N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW")

    /** "NW", "WNW"... for the compass caption. */
    fun compassPoint(degrees: Double): String = points[((Astro.fix(degrees, 360.0) + 11.25) / 22.5).toInt() % 16]

    /** Signed smallest difference a - b in (-180, 180]. */
    fun angleDelta(a: Double, b: Double): Double {
        var d = Astro.fix(a - b, 360.0)
        if (d > 180) d -= 360
        return d
    }
}
