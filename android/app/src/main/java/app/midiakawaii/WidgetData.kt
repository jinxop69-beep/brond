package app.midiakawaii

import org.json.JSONObject
import java.time.LocalDate

/** Pure (Android-free) logic: stored payload JSON + current date -> what the widget shows. */
object WidgetData {
    data class Row(
        val time: String,
        val title: String,
        val emoji: String,
        val done: Boolean,
        val rest: Boolean,
        val star: Boolean,
    ) {
        /** Text shown after the time column. */
        val label: String
            get() = buildString {
                if (done) append("✓ ")
                if (star) append("⭐ ")
                if (emoji.isNotBlank()) append(emoji).append(' ')
                append(title)
            }.trim()
    }

    data class DayView(
        val header: String,
        val count: String,
        val rows: List<Row>,
        val empty: String,
        val night: Boolean,
    )

    private val WEEKDAYS = arrayOf("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")

    const val EMPTY_TODAY = "Nada en tu horario hoy ✨"
    const val EMPTY_NO_DATA = "Abre Mi Día para ver tu horario 💗"
    const val EMPTY_STALE = "Abre Mi Día para actualizar 💗"

    fun header(date: LocalDate): String = "🎀 Hoy · ${WEEKDAYS[date.dayOfWeek.value - 1]} ${date.dayOfMonth}"

    fun build(json: String?, today: LocalDate): DayView {
        val header = header(today)
        if (json.isNullOrBlank()) return DayView(header, "", emptyList(), EMPTY_NO_DATA, false)
        val root = try { JSONObject(json) } catch (e: Exception) {
            return DayView(header, "", emptyList(), EMPTY_NO_DATA, false)
        }
        val night = root.optBoolean("night", false)
        val days = root.optJSONObject("days")
            ?: return DayView(header, "", emptyList(), EMPTY_NO_DATA, night)
        val key = today.toString() // ISO yyyy-MM-dd
        val arr = days.optJSONArray(key)
        if (arr == null) {
            // If every stored day is in the past, the data is stale (app not opened for a week).
            val stale = days.keys().asSequence().none { it >= key }
            return DayView(header, "", emptyList(), if (stale) EMPTY_STALE else EMPTY_TODAY, night)
        }
        val rows = (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            Row(
                time = o.optString("time", "").trim(),
                title = o.optString("title", "").trim(),
                emoji = o.optString("emoji", "").trim(),
                done = o.optBoolean("done", false),
                rest = o.optBoolean("rest", false),
                star = o.optBoolean("star", false),
            )
        }.filter { it.title.isNotEmpty() || it.emoji.isNotEmpty() }
            // stable sort: timed items by time, untimed last
            .sortedWith(compareBy<Row>({ it.time.isEmpty() }, { normTime(it.time) }))
        val tasks = rows.filter { !it.rest }
        val count = if (tasks.isEmpty()) "" else "${tasks.count { it.done }}/${tasks.size} ✓"
        return DayView(header, count, rows, EMPTY_TODAY, night)
    }

    /** "9:05" -> "09:05" so string ordering matches clock ordering. */
    private fun normTime(t: String): String = if (t.length == 4 && t[1] == ':') "0$t" else t
}
