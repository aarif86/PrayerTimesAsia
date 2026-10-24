package com.prayertimesasia.app.data

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Plain HTTPS with no SDKs: nothing but the request itself leaves the phone. */
object Http {
    private const val USER_AGENT = "PrayerTimesAsia/1.0 (Android)"

    fun get(url: String, timeoutMs: Int = 30_000): String = request(url, null, timeoutMs)

    fun postForm(url: String, fields: Map<String, String>, timeoutMs: Int = 40_000): String {
        val body = fields.entries.joinToString("&") { "${it.key}=${URLEncoder.encode(it.value, "UTF-8")}" }
        return request(url, body, timeoutMs)
    }

    private fun request(url: String, body: String?, timeoutMs: Int): String {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = timeoutMs
            c.readTimeout = timeoutMs
            c.setRequestProperty("User-Agent", USER_AGENT)
            c.setRequestProperty("Accept", "application/json")
            if (body != null) {
                c.requestMethod = "POST"
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
                c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            if (c.responseCode != 200) throw IOException("HTTP ${c.responseCode} for $url")
            return c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            c.disconnect()
        }
    }
}
