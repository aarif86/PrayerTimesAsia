package com.prayertimesasia.core

/**
 * The Tarawih counter. The user chooses 8 or 20 rakaat once (both are followed,
 * the app never says which), then taps after each salam. Each tap is 2 rakaat.
 * Same rules as web/src/core/tarawih.ts and ios Core/Tarawih.swift.
 */
object Tarawih {
    val CHOICES = listOf(8, 20)

    /** One salam: two more rakaat, never past the total. */
    fun tap(done: Int, total: Int): Int = minOf(total, maxOf(0, done) + 2)

    /** Take back the last salam. */
    fun undo(done: Int): Int = maxOf(0, done - 2)

    /** One dot per salam. */
    fun sets(total: Int): Int = total / 2
}
