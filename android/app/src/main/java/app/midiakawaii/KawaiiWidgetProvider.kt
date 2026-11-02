package app.midiakawaii

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import java.time.LocalDate
import java.time.ZoneId

class KawaiiWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        refreshAll(context)
    }

    override fun onEnabled(context: Context) = scheduleMidnight(context)

    override fun onDisabled(context: Context) {
        alarmManager(context).cancel(midnightIntent(context))
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_MIDNIGHT, Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED -> refreshAll(context)
        }
    }

    companion object {
        const val ACTION_MIDNIGHT = "app.midiakawaii.MIDNIGHT"
        const val PREFS = "kawaii_widget"
        const val KEY_PAYLOAD = "payload"

        fun payload(context: Context): String? =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PAYLOAD, null)

        fun refreshAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, KawaiiWidgetProvider::class.java))
            if (ids.isNotEmpty()) {
                val view = WidgetData.build(payload(context), LocalDate.now())
                for (id in ids) mgr.updateAppWidget(id, buildViews(context, id, view))
                @Suppress("DEPRECATION")
                mgr.notifyAppWidgetViewDataChanged(ids, R.id.list)
            }
            scheduleMidnight(context)
        }

        private fun buildViews(context: Context, widgetId: Int, view: WidgetData.DayView): RemoteViews {
            val c = Palette.of(view.night)
            val rv = RemoteViews(context.packageName, R.layout.widget)
            rv.setInt(R.id.root, "setBackgroundResource",
                if (view.night) R.drawable.widget_card_night else R.drawable.widget_card)
            rv.setTextViewText(R.id.header, view.header)
            rv.setTextColor(R.id.header, c.text)
            rv.setTextViewText(R.id.count, view.count)
            rv.setTextColor(R.id.count, c.time)
            rv.setTextViewText(R.id.empty, view.empty)
            rv.setTextColor(R.id.empty, c.muted)

            val svc = Intent(context, KawaiiWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            @Suppress("DEPRECATION")
            rv.setRemoteAdapter(R.id.list, svc)
            rv.setEmptyView(R.id.list, R.id.empty)

            val open = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val openPi = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            rv.setOnClickPendingIntent(R.id.headerRow, openPi)
            rv.setOnClickPendingIntent(R.id.empty, openPi)
            // Template for list rows must be mutable so fill-in intents can be merged.
            val tmplFlags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            rv.setPendingIntentTemplate(R.id.list,
                PendingIntent.getActivity(context, 1, open, tmplFlags))
            return rv
        }

        private fun alarmManager(context: Context) =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        private fun midnightIntent(context: Context): PendingIntent =
            PendingIntent.getBroadcast(context, 2,
                Intent(context, KawaiiWidgetProvider::class.java).setAction(ACTION_MIDNIGHT),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        /** Wake shortly after the next local midnight so "today" flips without opening the app. */
        fun scheduleMidnight(context: Context) {
            val zone = ZoneId.systemDefault()
            val at = LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli() + 5_000
            val am = alarmManager(context)
            val pi = midnightIntent(context)
            try {
                if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC, at, pi)
                } else {
                    am.setWindow(AlarmManager.RTC, at, 10 * 60_000L, pi)
                }
            } catch (e: SecurityException) {
                am.set(AlarmManager.RTC, at, pi)
            }
        }
    }
}

/** Widget colors (light kawaii / night). */
data class Palette(val text: Int, val time: Int, val muted: Int, val restBg: Int, val restTitle: Int) {
    companion object {
        private val LIGHT = Palette(0xFF6B3A52.toInt(), 0xFFFF5C9A.toInt(), 0xFFC4A5B5.toInt(),
            0xFFF3ECFF.toInt(), 0xFF8A6FD6.toInt())
        private val NIGHT = Palette(0xFFF7DFEA.toInt(), 0xFFFF8FB8.toInt(), 0xFF8F7585.toInt(),
            0xFF3A2A4A.toInt(), 0xFFC9B3FF.toInt())
        fun of(night: Boolean) = if (night) NIGHT else LIGHT
    }
}
