package com.drumless.app.ui

import android.app.Application
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.drumless.app.data.Api
import com.drumless.app.data.DrumlessApi
import com.drumless.app.data.JobCreated
import com.drumless.app.data.JobStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class Screen { Home, Progress, Results }

data class UiState(
    val screen: Screen = Screen.Home,
    val baseUrl: String = DEFAULT_BASE_URL,
    val submitting: Boolean = false,
    val jobId: String? = null,
    val job: JobStatus? = null,
    val error: String? = null,
)

/** 10.0.2.2 = host machine loopback from the Android emulator. */
const val DEFAULT_BASE_URL = "http://10.0.2.2:8000/"

class MainViewModel(app: Application) : AndroidViewModel(app) {

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var api: DrumlessApi = Api.client(DEFAULT_BASE_URL)

    fun setBaseUrl(raw: String) {
        val url = normalize(raw)
        if (url != null) {
            _state.update { it.copy(baseUrl = url) }
            api = Api.client(url)
        }
    }

    fun submitUrl(youtubeUrl: String) {
        launchJob { api.createFromUrl(youtubeUrl.trim()) }
    }

    fun submitFile(uri: Uri) {
        launchJob { api.createFromFile(Api.filePart(displayName(uri), readBytes(uri))) }
    }

    fun regen(bpm: Double?, clickGainDb: Double?) {
        val id = _state.value.jobId ?: return
        viewModelScope.launch {
            try {
                api.regen(id, com.drumless.app.data.RegenRequest(bpm, clickGainDb))
                poll(id) // refresh files after regen
            } catch (e: Exception) {
                setError(e)
            }
        }
    }

    fun backToHome() {
        _state.update { UiState(baseUrl = it.baseUrl) }
    }

    fun clearError() = _state.update { it.copy(error = null) }

    // ---- internals -----------------------------------------------------------

    private fun launchJob(create: suspend (DrumlessApi) -> JobCreated) {
        if (_state.value.submitting) return
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null) }
            try {
                val created = create(api)
                _state.update {
                    it.copy(submitting = false, jobId = created.jobId, screen = Screen.Progress)
                }
                poll(created.jobId)
            } catch (e: Exception) {
                setError(e)
                _state.update { it.copy(submitting = false) }
            }
        }
    }

    private suspend fun poll(jobId: String) {
        while (viewModelScope.isActive) {
            try {
                val s = api.status(jobId)
                _state.update {
                    it.copy(
                        job = s,
                        screen = when (s.status) {
                            "done" -> Screen.Results
                            "error" -> Screen.Progress // show error on progress screen
                            else -> Screen.Progress
                        },
                        error = if (s.status == "error") s.message else it.error,
                    )
                }
                if (s.status == "done" || s.status == "error") break
            } catch (e: Exception) {
                setError(e)
                break
            }
            delay(POLL_MS)
        }
    }

    private fun setError(e: Exception) {
        val msg = e.message ?: e.javaClass.simpleName
        _state.update { it.copy(error = msg) }
    }

    private suspend fun readBytes(uri: Uri): ByteArray = withContext(Dispatchers.IO) {
        getApplication<Application>().contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("Could not open selected file")
    }

    private fun displayName(uri: Uri): String {
        val resolver = getApplication<Application>().contentResolver
        resolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) c.getString(idx)?.let { return it }
            }
        }
        return "track.wav"
    }

    private fun normalize(raw: String): String? {
        var url = raw.trim()
        if (url.isEmpty()) return null
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://$url"
        }
        if (!url.endsWith("/")) url += "/"
        return url
    }

    private companion object {
        const val POLL_MS = 2_000L
    }
}