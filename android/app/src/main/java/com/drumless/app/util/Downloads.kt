package com.drumless.app.util

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

object Downloads {
    private val client by lazy { OkHttpClient() }

    /**
     * Stream [url] into the device's Music/Drumless folder via MediaStore.
     * No storage permission needed on API 29+.
     */
    suspend fun save(context: Context, url: String, baseName: String) {
        withContext(Dispatchers.IO) {
            val name = "$baseName.wav"
            val values = ContentValues().apply {
                put(MediaStore.Audio.Media.DISPLAY_NAME, name)
                put(MediaStore.Audio.Media.MIME_TYPE, "audio/wav")
                put(MediaStore.Audio.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MUSIC}/Drumless")
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
                ?: error("Could not create MediaStore entry")
            resolver.openOutputStream(uri)?.use { out ->
                val req = Request.Builder().url(url).build()
                client.newCall(req).execute().use { resp ->
                    check(resp.isSuccessful) { "Download failed: ${resp.code}" }
                    resp.body!!.byteStream().copyTo(out)
                }
            }
        }
    }
}