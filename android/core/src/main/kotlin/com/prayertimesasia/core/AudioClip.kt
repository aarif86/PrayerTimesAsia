package com.prayertimesasia.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Shapes a recording into an alert sound, for "Your own azan": the person picks a
 * file on their phone and it is made into a clip that stays on that phone. We never
 * upload it or ship it to anyone else.
 *
 * The same rules as the clip spec in docs/azan.md and iOS Core/AudioClip.swift:
 * - quiet lead-in removed, so the call starts straight away;
 * - at most [MAX_SECONDS] (iPhone plays nothing longer than 30 s as an alert);
 * - a [FADE_SECONDS] fade at the end, and a tiny fade in so it never clicks;
 * - loudness evened out to about -16 dB, the level of our own azan clips, and
 *   never louder than -1 dB at its peak.
 *
 * Works on mono samples from -1 to 1.
 */
object AudioClip {
    const val MAX_SECONDS = 29.0
    const val FADE_SECONDS = 0.5
    const val FADE_IN_SECONDS = 0.01
    const val MIN_SECONDS = 1.0
    /** About -16 dB: the loudness our own azan clips are made to (tools/make_azan.sh). */
    const val TARGET_RMS = 0.158f
    /** About -1 dB. */
    const val MAX_PEAK = 0.89f
    /** Never boost more than this (about +18 dB), so a near-silent file doesn't turn into hiss. */
    const val MAX_GAIN = 8f
    /** Anything quieter than this (about -34 dB) at the start counts as silence. */
    const val SILENCE = 0.02f

    data class Clip(val samples: FloatArray, val sampleRate: Int, val wasCut: Boolean) {
        val seconds: Double get() = samples.size.toDouble() / sampleRate
    }

    /** Null when the file has no sound in it, or less than [MIN_SECONDS] of it. */
    fun shape(input: FloatArray, sampleRate: Int): Clip? {
        if (sampleRate <= 0) return null
        val first = input.indexOfFirst { abs(it) > SILENCE }
        if (first < 0) return null
        val start = max(0, first - (0.05 * sampleRate).toInt())
        val maxLen = (MAX_SECONDS * sampleRate).toInt()
        val wasCut = input.size - start > maxLen
        val out = input.copyOfRange(start, min(input.size, start + maxLen))
        if (out.size < MIN_SECONDS * sampleRate) return null

        var sum = 0.0
        var peak = 0f
        for (s in out) { sum += s * s; peak = max(peak, abs(s)) }
        val rms = sqrt(sum / out.size).toFloat()
        if (rms <= 0f || peak <= 0f) return null
        val gain = minOf(TARGET_RMS / rms, MAX_PEAK / peak, MAX_GAIN)
        for (i in out.indices) out[i] *= gain

        val fadeIn = (FADE_IN_SECONDS * sampleRate).toInt().coerceAtMost(out.size)
        for (i in 0 until fadeIn) out[i] *= i.toFloat() / fadeIn
        val fade = (FADE_SECONDS * sampleRate).toInt().coerceAtMost(out.size)
        for (i in 0 until fade) {
            val at = out.size - fade + i
            out[at] *= (fade - 1 - i).toFloat() / max(1, fade - 1)
        }
        return Clip(out, sampleRate, wasCut)
    }

    /** Several channels, interleaved, made into one. */
    fun mono(interleaved: FloatArray, channels: Int): FloatArray {
        if (channels <= 1) return interleaved
        val out = FloatArray(interleaved.size / channels)
        for (i in out.indices) {
            var s = 0f
            for (c in 0 until channels) s += interleaved[i * channels + c]
            out[i] = s / channels
        }
        return out
    }
}
