package com.prayertimesasia.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.time.LocalDate
import java.time.ZoneId

/**
 * The expected times shared with the iPhone and web tests, read from the
 * repository's testdata/ folder (core/build.gradle.kts passes its path).
 */
object ExpectedTimes {
    data class Day(val source: String, val method: CalculationMethod, val date: LocalDate, val coordinates: Coordinates, val zone: ZoneId, val times: List<String>)
    data class YearPlace(val name: String, val method: CalculationMethod, val coordinates: Coordinates, val tzHours: Int, val days: Map<LocalDate, List<Int>>)

    private val dir = File(System.getProperty("testdata.dir") ?: "../../testdata")
    private fun read(name: String): JsonObject = Json.parseToJsonElement(File(dir, name).readText()).jsonObject

    private val file = read("expected-times.json")

    private fun days(section: String): List<Day> {
        val places = file.getValue("places").jsonObject
        return file.getValue(section).jsonObject.getValue("days").jsonArray.map {
            val d = it.jsonObject
            fun s(key: String) = d.getValue(key).jsonPrimitive.content
            val place = places.getValue(s("place")).jsonObject
            Day(
                source = s("source"),
                method = requireNotNull(CalculationMethod.withId(s("method"))) { "unknown method ${s("method")}" },
                date = LocalDate.parse(s("date")),
                coordinates = Coordinates(place.getValue("lat").jsonPrimitive.double, place.getValue("lng").jsonPrimitive.double),
                zone = ZoneId.of(place.getValue("timeZone").jsonPrimitive.content),
                times = d.getValue("times").jsonArray.map { t -> t.jsonPrimitive.content },
            )
        }
    }

    /** Official timetable days: never earlier than these. */
    val official: List<Day> get() = days("official")

    /** What the apps show, to the minute. */
    val exact: List<Day> get() = days("exact")

    /** Every day of 2026 from tools/reference_engine.py, in minutes after local midnight. */
    val wholeYear: List<YearPlace> get() = read(file.getValue("wholeYear").jsonObject.getValue("file").jsonPrimitive.content).map { (name, v) ->
        val r = v.jsonObject
        YearPlace(
            name = name,
            method = requireNotNull(CalculationMethod.withId(r.getValue("method").jsonPrimitive.content)),
            coordinates = Coordinates(r.getValue("lat").jsonPrimitive.double, r.getValue("lng").jsonPrimitive.double),
            tzHours = r.getValue("tzHours").jsonPrimitive.int,
            days = r.getValue("days").jsonObject.entries.associate { (date, mins) -> LocalDate.parse(date) to mins.jsonArray.map { it.jsonPrimitive.int } },
        )
    }
}
