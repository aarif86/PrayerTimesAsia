package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin
import kotlin.math.sqrt

/** "Your own azan": how a picked file is made into an alert sound. Same cases as iOS AudioClipTests.swift. */
class AudioClipTest {
    private val rate = 8000

    private fun tone(seconds: Double, level: Float, silenceBefore: Double = 0.0): FloatArray {
        val lead = (silenceBefore * rate).toInt()
        val n = (seconds * rate).toInt()
        return FloatArray(lead + n) { i -> if (i < lead) 0f else level * sin(2 * PI * 440 * (i - lead) / rate).toFloat() }
    }

    private fun rms(a: FloatArray, from: Int, to: Int): Float {
        var s = 0.0
        for (i in from until to) s += a[i] * a[i]
        return sqrt(s / (to - from)).toFloat()
    }

    @Test fun longFileIsCutToUnderThirtySeconds() {
        val clip = AudioClip.shape(tone(180.0, 0.3f), rate)!!
        assertTrue(clip.wasCut)
        assertEquals(AudioClip.MAX_SECONDS, clip.seconds, 0.01)
    }

    @Test fun shortFileIsKeptWhole() {
        val clip = AudioClip.shape(tone(12.0, 0.3f), rate)!!
        assertFalse(clip.wasCut)
        assertEquals(12.0, clip.seconds, 0.01)
    }

    @Test fun quietStartIsRemoved() {
        val clip = AudioClip.shape(tone(10.0, 0.3f, silenceBefore = 3.0), rate)!!
        assertEquals(10.05, clip.seconds, 0.01)
    }

    @Test fun endsWithAFadeToSilence() {
        val clip = AudioClip.shape(tone(10.0, 0.3f), rate)!!
        assertEquals(0f, clip.samples.last(), 1e-6f)
        val fade = (AudioClip.FADE_SECONDS * rate).toInt()
        val n = clip.samples.size
        assertTrue(rms(clip.samples, n - fade / 5, n) < rms(clip.samples, n - fade - rate, n - fade) / 4)
    }

    @Test fun quietRecordingIsRaisedToTheSameLevelAsOurClips() {
        val clip = AudioClip.shape(tone(10.0, 0.05f), rate)!!
        assertEquals(AudioClip.TARGET_RMS, rms(clip.samples, rate, 5 * rate), 0.01f)
    }

    @Test fun loudRecordingIsNeverLouderThanTheCap() {
        val clip = AudioClip.shape(tone(10.0, 1f), rate)!!
        assertTrue(clip.samples.all { abs(it) <= AudioClip.MAX_PEAK + 1e-4f })
    }

    @Test fun silentOrTooShortFilesAreRefused() {
        assertNull(AudioClip.shape(FloatArray(rate * 5), rate))
        assertNull(AudioClip.shape(tone(0.5, 0.3f), rate))
    }

    @Test fun stereoIsMadeMono() {
        val m = AudioClip.mono(floatArrayOf(0.2f, 0.4f, -0.2f, 0.2f), 2)
        assertEquals(2, m.size)
        assertEquals(0.3f, m[0], 1e-6f)
        assertEquals(0f, m[1], 1e-6f)
    }
}
