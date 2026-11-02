package app.midiakawaii

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class WidgetDataTest {
    private val payload = """
        {"v":1,"updatedAt":1793579687921,"night":false,"days":{
          "2026-11-02":[
            {"time":"","title":"Leer","emoji":"📖","done":false,"rest":false,"star":false},
            {"time":"10:00","title":"Desayunar","emoji":"🧴","done":true,"rest":false,"star":false},
            {"time":"9:30","title":"Yoga","emoji":"🧘","done":false,"rest":false,"star":true},
            {"time":"14:00","title":"Siesta","emoji":"😴","done":false,"rest":true,"star":false}
          ],
          "2026-11-03":[{"time":"08:00","title":"Gym","emoji":"","done":false,"rest":false,"star":false}]
        }}
    """.trimIndent()

    @Test fun header_uses_spanish_weekday() {
        assertEquals("🎀 Hoy · lunes 2", WidgetData.header(LocalDate.of(2026, 11, 2)))
        assertEquals("🎀 Hoy · miércoles 4", WidgetData.header(LocalDate.of(2026, 11, 4)))
        assertEquals("🎀 Hoy · domingo 8", WidgetData.header(LocalDate.of(2026, 11, 8)))
    }

    @Test fun rows_sorted_and_counted() {
        val v = WidgetData.build(payload, LocalDate.of(2026, 11, 2))
        assertEquals(listOf("9:30", "10:00", "14:00", ""), v.rows.map { it.time })
        assertEquals("⭐ 🧘 Yoga", v.rows[0].label)
        assertEquals("✓ 🧴 Desayunar", v.rows[1].label)
        assertTrue(v.rows[2].rest)
        assertEquals("1/3 ✓", v.count) // rest items not counted
    }

    @Test fun picks_day_by_date() {
        val v = WidgetData.build(payload, LocalDate.of(2026, 11, 3))
        assertEquals(1, v.rows.size)
        assertEquals("Gym", v.rows[0].label)
        assertEquals("0/1 ✓", v.count)
    }

    @Test fun empty_states() {
        assertEquals(WidgetData.EMPTY_NO_DATA, WidgetData.build(null, LocalDate.of(2026, 11, 2)).empty)
        assertEquals(WidgetData.EMPTY_NO_DATA, WidgetData.build("not json", LocalDate.of(2026, 11, 2)).empty)
        val missingFuture = WidgetData.build(payload, LocalDate.of(2026, 11, 1))
        assertTrue(missingFuture.rows.isEmpty()); assertEquals(WidgetData.EMPTY_TODAY, missingFuture.empty)
        val stale = WidgetData.build(payload, LocalDate.of(2026, 11, 20))
        assertEquals(WidgetData.EMPTY_STALE, stale.empty)
        val emptyDay = WidgetData.build("""{"days":{"2026-11-02":[]}}""", LocalDate.of(2026, 11, 2))
        assertEquals(WidgetData.EMPTY_TODAY, emptyDay.empty); assertEquals("", emptyDay.count)
    }

    @Test fun night_flag() {
        assertTrue(WidgetData.build("""{"night":true,"days":{}}""", LocalDate.of(2026, 11, 2)).night)
    }
}
