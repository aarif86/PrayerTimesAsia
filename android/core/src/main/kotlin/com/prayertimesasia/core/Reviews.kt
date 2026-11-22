package com.prayertimesasia.core

import java.time.Duration
import java.time.Instant

/**
 * Public reviews and private notes for the makers (Ustaz Aarif Raziff and Nasar Digital).
 * No sign in and no server: review buttons open Google Play or Google, private notes open
 * the site's note page with the words filled in. Same words and rules as the web and iPhone apps.
 */
object Reviews {
    /** Set to true once the app is live on Google Play; the Play button stays hidden until then. */
    const val ON_GOOGLE_PLAY = false
    const val PACKAGE = "com.prayertimesasia.app"
    /** Nasar Digital's Google review page (Google Business Profile). */
    const val GOOGLE_REVIEW = "https://g.page/r/CSq5hZxhRs1BEBM/review"
    const val FEEDBACK_EMAIL = "salam@prayertimes.asia"
    const val NOTE_PAGE = "https://prayertimes.asia/note.html"

    data class Link(val id: String, val title: String, val subtitle: String, val url: String)

    fun links(onGooglePlay: Boolean = ON_GOOGLE_PLAY): List<Link> = buildList {
        if (onGooglePlay) add(Link("play", "Review on Google Play", "For the Android app", "https://play.google.com/store/apps/details?id=$PACKAGE&showAllReviews=true"))
        add(Link("google", "Review Nasar Digital on Google", "The team in Singapore who builds the app", GOOGLE_REVIEW))
    }

    enum class NoteKind(val label: String, val hint: String) {
        KIND("A kind word", "What has the app helped you with?"),
        IDEA("An idea", "What would make the app better for you?"),
        TIME("A time looks wrong", "Which prayer, which day, and what does your masjid show?"),
        BROKE("Something is not working", "What did you tap, and what happened?"),
    }

    /** The email a private note becomes. */
    fun noteEmail(kind: NoteKind, text: String, details: String?, mayShare: Boolean): Pair<String, String> {
        val lines = mutableListOf(text.trim().ifEmpty { "(no words)" }, "")
        if (kind == NoteKind.KIND) lines += if (mayShare) "You may share these words on the website, without my name." else "Please keep these words private."
        if (details != null) lines += listOf("", details)
        return "${kind.label} | Prayer Times Asia" to lines.joinToString("\n").trim() + "\n"
    }

    /** The form's "What is this about" choice for a kind of note. */
    fun about(kind: NoteKind): String = if (kind == NoteKind.TIME) "A prayer time looks wrong" else kind.label

    /** The site's note page with the form already filled in. Sending it there thanks the person and emails a confirmation. */
    fun noteUrl(about: String, note: String, place: String = ""): String {
        fun enc(v: String) = java.net.URLEncoder.encode(v, "UTF-8")
        return "$NOTE_PAGE?note_is_about=${enc(about)}&note_to_the_makers=${enc(note.trim())}" + if (place.isNotBlank()) "&note_masjid_or_place=${enc(place.trim())}" else ""
    }

    /**
     * A calm moment for the review line or the star box: after [days] days of use, not within
     * 15 minutes before a prayer or 15 minutes after one began.
     */
    fun isCalm(openDays: Int, days: Int, now: Instant, current: Instant?, next: Instant?): Boolean {
        if (openDays < days) return false
        if (next != null && Duration.between(now, next).toMinutes() < 15) return false
        if (current != null && Duration.between(current, now).toMinutes() < 15) return false
        return true
    }

    /** Google's star box: 14+ days, calm, at most every 4 months, and only after our own line is done. */
    fun mayAskForStars(p: Preferences, now: Instant, current: Instant?, next: Instant?): Boolean =
        p.hasOnboarded && isCalm(p.openDayCount, 14, now, current, next) &&
            now.toEpochMilli() - p.starBoxAskedAt > 120L * 86_400_000 &&
            (p.noteCardDone || p.reviewTappedAt > 0)
}
