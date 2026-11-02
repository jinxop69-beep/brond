package app.midiakawaii

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StrikethroughSpan
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import java.time.LocalDate

class KawaiiWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = Factory(applicationContext)

    private class Factory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
        private var view = WidgetData.build(null, LocalDate.now())

        override fun onCreate() {}
        override fun onDataSetChanged() {
            view = WidgetData.build(KawaiiWidgetProvider.payload(context), LocalDate.now())
        }
        override fun onDestroy() {}
        override fun getCount() = view.rows.size
        override fun getLoadingView(): RemoteViews? = null
        override fun getViewTypeCount() = 1
        override fun getItemId(position: Int) = position.toLong()
        override fun hasStableIds() = false

        override fun getViewAt(position: Int): RemoteViews {
            val rv = RemoteViews(context.packageName, R.layout.widget_row)
            val row = view.rows.getOrNull(position) ?: return rv
            val c = Palette.of(view.night)
            rv.setTextViewText(R.id.time, row.time)
            rv.setTextColor(R.id.time, if (row.done) c.muted else c.time)
            val label: CharSequence = if (row.done) {
                SpannableString(row.label).apply {
                    setSpan(StrikethroughSpan(), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
            } else row.label
            rv.setTextViewText(R.id.title, label)
            rv.setTextColor(R.id.title, when {
                row.done -> c.muted
                row.rest -> c.restTitle
                else -> c.text
            })
            rv.setInt(R.id.row, "setBackgroundColor", if (row.rest) c.restBg else Color.TRANSPARENT)
            rv.setOnClickFillInIntent(R.id.row, Intent())
            return rv
        }
    }
}
