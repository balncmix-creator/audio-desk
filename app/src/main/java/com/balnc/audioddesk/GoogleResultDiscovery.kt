package com.balnc.audioddesk

import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

internal object GoogleResultDiscovery {
    fun isGoogleResults(raw: String?): Boolean {
        val u = try { Uri.parse(raw ?: return false) } catch (_: Exception) { return false }
        return u.scheme == "https" && u.userInfo == null && (u.port == -1 || u.port == 443) &&
            u.host in setOf("www.google.com", "google.com") && u.path == "/search"
    }

    // Executed only on the visible Google search page. No cookies, forms,
    // account information, browsing history, ads or hidden text are read.
    val resultScript = """
        (() => {
          const out=[];
          for(const h of document.querySelectorAll('h3')){
            if(out.length>=60)break;
            const a=h.closest('a[href]');if(!a||!h.getClientRects().length)continue;
            if(a.closest('[data-text-ad], [data-ad-client], #tads, #bottomads'))continue;
            try{
              let u=new URL(a.href,location.href);
              if(u.origin===location.origin&&u.pathname==='/url'){
                const dest=u.searchParams.get('q')||u.searchParams.get('url');
                if(!dest)continue;u=new URL(dest);
              }
              if(u.protocol!=='https:'||u.username||u.password)continue;
              out.push({title:(h.innerText||'').trim().slice(0,300),url:u.href.slice(0,1500)});
            }catch(e){}
          }
          return out;
        })()
    """.trimIndent()

    fun decodeRows(raw: String?): JSONArray {
        val result=JSONArray()
        if(raw==null||raw.length>140000)return result
        try {
            val value=JSONTokener(raw).nextValue()
            val rows=when(value){is JSONArray -> value; is String -> JSONArray(value); else -> return result}
            for(i in 0 until minOf(rows.length(),60)){
                val obj=rows.optJSONObject(i)?:continue
                val title=obj.optString("title").take(300)
                val url=obj.optString("url").take(1500)
                if(title.isNotBlank()&&url.startsWith("https://"))result.put(JSONObject().put("title",title).put("url",url))
            }
        }catch(_:Exception){}
        return result
    }
}
