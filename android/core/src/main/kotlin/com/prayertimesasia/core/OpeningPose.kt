package com.prayertimesasia.core

import kotlin.math.max
import kotlin.math.min

/**
 * The moving opening screen: eleven ways the icon's dial comes in, about a second each.
 * The clock hands always sweep round to the real time.
 * The same movements play on iPhone (OpeningView.swift) and the web app (index.html).
 */
enum class OpeningMove { COMPASS, CLOCK, BATIK, STITCH, SUNRISE, KAABAH, TAWAF, DROP, FLIP, PIECES, SPIRAL;

    companion object {
        /**
         * The next movement from a shuffled [bag] of all of them, so every one comes round
         * once before any repeats. A new bag never starts with [last]. Returns the bag left.
         */
        fun next(bag: List<Int>, last: Int?, random: kotlin.random.Random = kotlin.random.Random): Pair<OpeningMove, List<Int>> {
            var left = bag.filter { it in entries.indices }
            if (left.isEmpty()) {
                left = entries.indices.shuffled(random)
                if (left.first() == last) left = left.drop(1) + left.first()
            }
            return entries[left.first()] to left.drop(1)
        }
    }
}

/** Where the clock hands point for a time of day, in degrees from 12. */
data class OpeningClock(val hour: Double, val minute: Double) {
    companion object {
        fun at(hour: Int, minute: Int, second: Int): OpeningClock {
            val m = minute + second / 60.0
            return OpeningClock(((hour % 12) + m / 60) * 30, m * 6)
        }
    }
}

/** How every layer of the opening screen sits [ms] milliseconds in. */
data class OpeningPose(
    val dialScale: Double = 1.0, val dialOpacity: Double = 1.0, val dialY: Double = 0.0, val dialRot: Double = 0.0, val dialFlip: Double = 1.0,
    val ringRot: Double = 0.0, val ringScale: Double = 1.0, val ringOpacity: Double = 1.0,
    val batikRot: Double = 0.0, val batikOpacity: Double = 1.0,
    val stitchOuterRot: Double = 0.0, val stitchInnerRot: Double = 0.0, val stitchOpacity: Double = 1.0, val marksOpacity: Double = 1.0,
    val kaabahScale: Double = 1.0, val kaabahOpacity: Double = 1.0,
    val centreScale: Double = 1.0, val centreOpacity: Double = 1.0, val faceOpacity: Double = 1.0, val handsOpacity: Double = 1.0,
    val hourRot: Double, val minuteRot: Double,
    val glowOpacity: Double = 1.0, val glowY: Double = 0.0,
    val nameIn: Double = 1.0, val lineIn: Double = 1.0,
) {
    companion object {
        const val LENGTH_MS = 1350L

        fun at(move: OpeningMove, ms: Double, clock: OpeningClock): OpeningPose {
            val t = ms
            val h = clock.hour
            val m = clock.minute
            // The hands sweep round to the real time in every movement.
            fun sweep(delay: Double = 0.0): Pair<Double, Double> {
                val a = ease(seg(t, delay, 1000 - delay))
                return mix(h - 90, h, a) to mix(m - 300, m, a)
            }
            val (sh, sm) = sweep()
            var p = OpeningPose(hourRot = sh, minuteRot = sm)
            var words = 250.0
            when (move) {
                OpeningMove.COMPASS -> // the ring swings like a real compass and settles on North
                    p = p.copy(
                        ringRot = keys(easeInOut(seg(t, 0.0, 1000.0)), -75.0 to 0.0, 28.0 to 0.38, -11.0 to 0.62, 4.0 to 0.82, 0.0 to 1.0),
                        dialOpacity = keys(ease(seg(t, 0.0, 1000.0)), 0.0 to 0.0, 1.0 to 0.2, 1.0 to 1.0))
                OpeningMove.CLOCK -> { // the hands spin from twelve round to the real time
                    val a = ease(seg(t, 0.0, 1000.0))
                    val q = ease(seg(t, 0.0, 400.0))
                    p = p.copy(hourRot = mix(0.0, h + 360, a), minuteRot = mix(0.0, m + 1080, a), dialOpacity = q, dialScale = mix(0.94, 1.0, q))
                }
                OpeningMove.BATIK -> { // the kawung ring turns and glows in
                    val a = ease(seg(t, 0.0, 1000.0))
                    val q = ease(seg(t, 0.0, 600.0))
                    p = p.copy(batikRot = mix(-90.0, 0.0, a), batikOpacity = a, dialScale = mix(0.9, 1.0, q), dialOpacity = q)
                }
                OpeningMove.STITCH -> { // the two stitch rings run opposite ways as the dial pops in
                    val a = ease(seg(t, 0.0, 1000.0))
                    val q = easeOut(seg(t, 0.0, 700.0))
                    p = p.copy(stitchOuterRot = mix(-120.0, 0.0, a), stitchInnerRot = mix(120.0, 0.0, a),
                        dialScale = keys(q, 0.7 to 0.0, 1.06 to 0.55, 1.0 to 1.0), dialOpacity = keys(q, 0.0 to 0.0, 1.0 to 0.55, 1.0 to 1.0))
                    words = 300.0
                }
                OpeningMove.SUNRISE -> { // dawn glows and the dial rises into place
                    val a = ease(seg(t, 0.0, 1000.0))
                    p = p.copy(glowOpacity = a, glowY = mix(0.3, 0.0, a),
                        dialY = keys(a, 0.5 to 0.0, -6.0 / 180 to 0.7, 0.0 to 1.0), dialScale = keys(a, 0.85 to 0.0, 1.0 to 0.7, 1.0 to 1.0),
                        dialOpacity = keys(a, 0.0 to 0.0, 1.0 to 0.7, 1.0 to 1.0))
                    words = 400.0
                }
                OpeningMove.KAABAH -> { // the Kaabah first, then the face and the compass open out around it
                    val k = ease(seg(t, 0.0, 450.0))
                    val c = ease(seg(t, 250.0, 450.0))
                    val r = ease(seg(t, 500.0, 500.0))
                    val (kh, km) = sweep(250.0)
                    p = p.copy(kaabahScale = keys(k, 0.3 to 0.0, 1.15 to 0.6, 1.0 to 1.0), kaabahOpacity = keys(k, 0.0 to 0.0, 1.0 to 0.6, 1.0 to 1.0),
                        centreScale = mix(0.4, 1.0, c), centreOpacity = c, ringScale = mix(0.6, 1.0, r), ringRot = mix(-40.0, 0.0, r), ringOpacity = r,
                        hourRot = kh, minuteRot = km)
                    words = 500.0
                }
                OpeningMove.TAWAF -> { // the ring circles once anticlockwise, the way of tawaf round the Kaabah
                    p = p.copy(ringRot = mix(360.0, 0.0, ease(seg(t, 0.0, 1000.0))), dialOpacity = ease(seg(t, 0.0, 250.0)))
                    words = 300.0
                }
                OpeningMove.DROP -> { // the dial drops in from above and settles with a soft bounce
                    val a = seg(t, 0.0, 1000.0)
                    p = p.copy(dialY = keys(a, -160.0 / 180 to 0.0, -110.0 / 180 to 0.15, 0.0 to 0.55, -14.0 / 180 to 0.7, 0.0 to 0.85, -4.0 / 180 to 0.93, 0.0 to 1.0),
                        dialOpacity = keys(a, 0.0 to 0.0, 1.0 to 0.15, 1.0 to 1.0))
                    words = 450.0
                }
                OpeningMove.FLIP -> { // the dial spins on its edge like a coin, then faces you
                    val a = ease(seg(t, 0.0, 900.0))
                    p = p.copy(dialFlip = keys(a, 0.0 to 0.0, 1.0 to 0.3, 0.0 to 0.55, 1.0 to 1.0), dialOpacity = keys(a, 0.0 to 0.0, 1.0 to 0.3, 1.0 to 1.0))
                    words = 350.0
                }
                OpeningMove.PIECES -> { // the dial builds up piece by piece, from the ring in to the hands
                    val r = ease(seg(t, 0.0, 250.0))
                    val k = ease(seg(t, 500.0, 300.0))
                    val hp = ease(seg(t, 600.0, 400.0))
                    p = p.copy(ringOpacity = r, ringScale = mix(0.9, 1.0, r), batikOpacity = ease(seg(t, 100.0, 250.0)),
                        stitchOpacity = ease(seg(t, 200.0, 250.0)), marksOpacity = ease(seg(t, 300.0, 250.0)), faceOpacity = ease(seg(t, 400.0, 250.0)),
                        kaabahScale = keys(k, 0.3 to 0.0, 1.15 to 0.6, 1.0 to 1.0), kaabahOpacity = keys(k, 0.0 to 0.0, 1.0 to 0.6, 1.0 to 1.0),
                        handsOpacity = ease(seg(t, 600.0, 250.0)), hourRot = mix(h - 90, h, hp), minuteRot = mix(m - 300, m, hp))
                    words = 500.0
                }
                OpeningMove.SPIRAL -> { // the dial spirals in from far away
                    val a = ease(seg(t, 0.0, 1000.0))
                    p = p.copy(dialRot = keys(a, -270.0 to 0.0, -150.0 to 0.3, 0.0 to 1.0), dialScale = keys(a, 0.2 to 0.0, 0.6 to 0.3, 1.0 to 1.0),
                        dialOpacity = keys(a, 0.0 to 0.0, 1.0 to 0.3, 1.0 to 1.0))
                    words = 350.0
                }
            }
            return p.copy(nameIn = ease(seg(t, words, 500.0)), lineIn = ease(seg(t, words + 100, 500.0)))
        }

        /** 0 before [delay], 1 after delay + [length], straight in between. */
        fun seg(t: Double, delay: Double, length: Double) = min(1.0, max(0.0, (t - delay) / length))
        fun mix(a: Double, b: Double, p: Double) = a + (b - a) * p

        /** Straight lines between (value to offset) keys, like a CSS keyframe list. */
        fun keys(p: Double, vararg k: Pair<Double, Double>): Double {
            for (i in 1 until k.size) if (p <= k[i].second) {
                return mix(k[i - 1].first, k[i].first, (p - k[i - 1].second) / (k[i].second - k[i - 1].second))
            }
            return k.last().first
        }

        /** cubic-bezier(.2, .8, .2, 1): quick start, soft landing. */
        fun ease(x: Double) = bezier(x, 0.2, 0.8, 0.2, 1.0)
        fun easeInOut(x: Double) = bezier(x, 0.42, 0.0, 0.58, 1.0)
        fun easeOut(x: Double) = bezier(x, 0.0, 0.0, 0.58, 1.0)

        fun bezier(x: Double, x1: Double, y1: Double, x2: Double, y2: Double): Double {
            if (x <= 0) return 0.0
            if (x >= 1) return 1.0
            fun at(s: Double, a: Double, b: Double) = 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s
            var lo = 0.0
            var hi = 1.0
            var s = x
            repeat(30) {
                s = (lo + hi) / 2
                if (at(s, x1, x2) < x) lo = s else hi = s
            }
            return at(s, y1, y2)
        }
    }
}
