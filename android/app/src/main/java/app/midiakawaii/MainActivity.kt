package app.midiakawaii

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {

    private lateinit var web: WebView
    private var popup: WebView? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION")
        window.statusBarColor = PINK

        val root = FrameLayout(this).apply { setBackgroundColor(PINK) }
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        // Android 15+ forces edge-to-edge: pad for status/nav bars and keyboard ourselves.
        root.setOnApplyWindowInsetsListener { v, insets ->
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            val ime = insets.getInsets(WindowInsets.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsets.CONSUMED
        }
        setContentView(root)

        CookieManager.getInstance().setAcceptCookie(true)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            mediaPlaybackRequiresUserGesture = false
        }
        web.addJavascriptInterface(WidgetBridge(applicationContext), "KawaiiWidget")
        web.addJavascriptInterface(FileBridge(), "KawaiiFiles")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleExternal(request.url)
        }
        web.webChromeClient = Chrome()
        web.setDownloadListener { url, _, _, mimeType, _ ->
            if (url.startsWith("blob:")) {
                val ext = android.webkit.MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "bin"
                val name = "mi-dia-kawaii-${java.time.LocalDate.now()}.$ext"
                // Read the blob in the page and hand it to the native side as base64.
                web.evaluateJavascript("""
                    (function(){fetch(${JSONObject.quote(url)}).then(r=>r.blob()).then(b=>{
                      var fr=new FileReader();fr.onload=function(){
                        var s=String(fr.result);KawaiiFiles.save(s.substring(s.indexOf(',')+1),
                        ${JSONObject.quote(name)},b.type||${JSONObject.quote(mimeType ?: "")});
                      };fr.readAsDataURL(b);});})();
                """.trimIndent(), null)
            } else {
                openInBrowser(Uri.parse(url))
            }
        }
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(HOME)
        KawaiiWidgetProvider.refreshAll(applicationContext)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    override fun onDestroy() {
        popup?.destroy()
        web.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            fileCallback = null
        } else {
            @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        }
    }

    private fun isInternal(uri: Uri): Boolean {
        val host = uri.host ?: return true
        return host == APP_HOST || host.endsWith(".supabase.co") || host == "supabase.co"
    }

    /** true = handled outside the WebView. */
    private fun handleExternal(uri: Uri): Boolean {
        val scheme = uri.scheme ?: return false
        if (scheme == "blob" || scheme == "data" || scheme == "about" || scheme == "javascript") return false
        if ((scheme == "http" || scheme == "https") && isInternal(uri)) return false
        openInBrowser(uri)
        return true
    }

    private fun openInBrowser(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No se puede abrir el enlace", Toast.LENGTH_SHORT).show()
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams,
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            return try {
                @Suppress("DEPRECATION")
                startActivityForResult(params.createIntent(), REQ_FILE)
                true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }

        /** window.open(): blob: pages (printable reports) are printed; web links go to the browser. */
        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            popup?.destroy()
            val p = WebView(this@MainActivity)
            p.settings.javaScriptEnabled = true
            p.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    if (r.url.scheme == "blob" || r.url.scheme == "data") return false
                    openInBrowser(r.url); return true
                }
                override fun onPageStarted(v: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    val u = Uri.parse(url)
                    if (u.scheme == "http" || u.scheme == "https") {
                        v.stopLoading(); openInBrowser(u)
                    }
                }
                override fun onPageFinished(v: WebView, url: String) {
                    if (url.startsWith("blob:") || url.startsWith("data:")) {
                        val pm = getSystemService(Context.PRINT_SERVICE) as PrintManager
                        pm.print("Mi Día", v.createPrintDocumentAdapter("Mi Día"), null)
                    }
                }
            }
            popup = p
            (resultMsg.obj as WebView.WebViewTransport).webView = p
            resultMsg.sendToTarget()
            return true
        }
    }

    /** Saves blob downloads (e.g. the JSON backup) into Downloads. */
    private inner class FileBridge {
        @JavascriptInterface
        fun save(base64: String, name: String, mime: String) {
            val ok = try {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                val type = mime.ifBlank { "application/octet-stream" }
                if (Build.VERSION.SDK_INT >= 29) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, name)
                        put(MediaStore.Downloads.MIME_TYPE, type)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: error("insert failed")
                    contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
                } else {
                    val dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
                    File(dir, name).writeBytes(bytes)
                }
                true
            } catch (e: Exception) { false }
            runOnUiThread {
                Toast.makeText(this@MainActivity,
                    if (ok) "Guardado en Descargas: $name 💗" else "No se pudo guardar el archivo",
                    Toast.LENGTH_LONG).show()
            }
        }
    }

    companion object {
        const val HOME = "https://mi-dia-kawaii.vercel.app/"
        const val APP_HOST = "mi-dia-kawaii.vercel.app"
        const val PINK = 0xFFFF8FB8.toInt()
        private const val REQ_FILE = 41
    }
}

/** window.KawaiiWidget.update(JSON.stringify(payload)) from the web app. */
class WidgetBridge(private val context: Context) {
    @JavascriptInterface
    fun update(json: String?) {
        if (json == null || json.length > 500_000) return
        try { JSONObject(json) } catch (e: Exception) { return }
        context.getSharedPreferences(KawaiiWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit().putString(KawaiiWidgetProvider.KEY_PAYLOAD, json).apply()
        KawaiiWidgetProvider.refreshAll(context)
    }
}
