package com.drumless.app.data

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

/** Retrofit contract for the Drumless backend (see server/api.py). */
interface DrumlessApi {

    @GET("api/health")
    suspend fun health(): Health

    /** Create a job from a YouTube URL. */
    @FormUrlEncoded
    @POST("api/jobs")
    suspend fun createFromUrl(@Field("url") url: String): JobCreated

    /** Create a job from an uploaded audio file. */
    @Multipart
    @POST("api/jobs")
    suspend fun createFromFile(@Part file: MultipartBody.Part): JobCreated

    @GET("api/jobs/{id}")
    suspend fun status(@Path("id") id: String): JobStatus

    @POST("api/jobs/{id}/regen")
    suspend fun regen(@Path("id") id: String, @Body req: RegenRequest): RegenResponse
}

object Api {
    private val json = Json { ignoreUnknownKeys = true }

    /** Build a client bound to the given base URL. Base URL must end with '/'. */
    fun client(baseUrl: String): DrumlessApi {
        val http = okhttp3.OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(http)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(DrumlessApi::class.java)
    }

    fun filePart(filename: String, bytes: ByteArray): MultipartBody.Part {
        val body: RequestBody = bytes.toRequestBody("audio/*".toMediaType())
        return MultipartBody.Part.createFormData("file", filename, body)
    }
}