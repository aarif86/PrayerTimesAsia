package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** The moving opening screen: every movement ends on the still icon, hands on the real time. */
class OpeningPoseTest {
    private val clock = OpeningClock.at(15, 30, 0)

    @Test fun handsPointAtTheTime() {
        assertEquals(180.0, clock.minute, 1e-9)
        assertEquals(105.0, clock.hour, 1e-9)
    }

    @Test fun everyMovementEndsOnTheStillDial() {
        for (move in OpeningMove.entries) {
            val p = OpeningPose.at(move, OpeningPose.LENGTH_MS.toDouble(), clock)
            val ends = mapOf(
                "dialScale" to (p.dialScale to 1.0), "dialOpacity" to (p.dialOpacity to 1.0), "dialY" to (p.dialY to 0.0),
                "ringRot" to (p.ringRot to 0.0), "ringScale" to (p.ringScale to 1.0), "ringOpacity" to (p.ringOpacity to 1.0),
                "batikRot" to (p.batikRot to 0.0), "batikOpacity" to (p.batikOpacity to 1.0),
                "stitchOuterRot" to (p.stitchOuterRot to 0.0), "stitchInnerRot" to (p.stitchInnerRot to 0.0),
                "kaabahScale" to (p.kaabahScale to 1.0), "centreOpacity" to (p.centreOpacity to 1.0),
                "glowOpacity" to (p.glowOpacity to 1.0), "nameIn" to (p.nameIn to 1.0), "lineIn" to (p.lineIn to 1.0),
            )
            val more = mapOf("dialRot" to (p.dialRot to 0.0), "dialFlip" to (p.dialFlip to 1.0), "stitchOpacity" to (p.stitchOpacity to 1.0),
                "marksOpacity" to (p.marksOpacity to 1.0), "faceOpacity" to (p.faceOpacity to 1.0), "handsOpacity" to (p.handsOpacity to 1.0))
            for ((name, v) in ends + more) assertEquals("$move $name", v.second, v.first, 1e-6)
            assertEquals("$move hour", 105.0, p.hourRot % 360, 1e-6)
            assertEquals("$move minute", 180.0, p.minuteRot % 360, 1e-6)
        }
    }

    @Test fun eachMovementStartsSomewhereElse() {
        for (move in OpeningMove.entries) {
            assertNotEquals("$move", OpeningPose.at(move, 0.0, clock), OpeningPose.at(move, 2000.0, clock))
        }
    }

    @Test fun theHandsMoveInEveryMovement() {
        for (move in OpeningMove.entries) {
            assertNotEquals("$move", OpeningPose.at(move, 0.0, clock).minuteRot, OpeningPose.at(move, 700.0, clock).minuteRot, 1e-6)
        }
    }

    @Test fun everyMovementComesRoundBeforeAnyRepeats() {
        val random = Random(7)
        val n = OpeningMove.entries.size
        var bag = emptyList<Int>()
        var last: Int? = null
        val seen = mutableListOf<OpeningMove>()
        repeat(n * 20) {
            val (next, rest) = OpeningMove.next(bag, last, random)
            assertTrue(next.ordinal != last)
            seen += next; bag = rest; last = next.ordinal
        }
        seen.chunked(n).forEach { assertEquals(n, it.toSet().size) }
    }
}
