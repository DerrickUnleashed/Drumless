package com.drumless.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Health(val status: String)

@Serializable
data class JobCreated(@SerialName("job_id") val jobId: String)

@Serializable
data class JobStatus(
    @SerialName("job_id") val jobId: String,
    val status: String,
    val stage: String? = null,
    val progress: Int? = null,
    val message: String? = null,
    val bpm: Double? = null,
    @SerialName("tempo_source") val tempoSource: String? = null,
    /** variant -> relative URL, e.g. "backing" -> "/api/jobs/x/audio/backing.wav" */
    val files: Map<String, String> = emptyMap(),
)

@Serializable
data class RegenRequest(
    val bpm: Double? = null,
    @SerialName("click_gain_db") val clickGainDb: Double? = null,
    val speed: Double? = null,
)

@Serializable
data class RegenResponse(
    @SerialName("job_id") val jobId: String,
    val bpm: Double? = null,
)