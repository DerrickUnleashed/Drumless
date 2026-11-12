package com.drumless.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

@Composable
fun ResultsScreen(vm: MainViewModel, state: UiState) {
    val job = state.job ?: run { vm.backToHome(); return }

    var bpmText by remember(job.bpm) { mutableStateOf((job.bpm?.roundToInt() ?: 120).toString()) }
    var gainDb by remember { mutableStateOf(0f) }

    val base = remember(state.baseUrl) { state.baseUrl.trimEnd('/') }
    val urlBacking = job.files["backing"]?.let { base + it }
    val urlMixed = job.files["mixed"]?.let { base + it }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("Results", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Detected tempo: ${job.bpm?.roundToInt() ?: "?"} BPM " +
                "(source: ${job.tempoSource ?: "?"})",
            style = MaterialTheme.typography.bodyMedium,
        )

        OutlinedTextField(
            value = bpmText,
            onValueChange = { bpmText = it },
            label = { Text("BPM (editable)") },
            singleLine = true,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                (bpmText.toIntOrNull() ?: 120).let { bpmText = ((it / 2).coerceAtLeast(30)).toString() }
            }) { Text("÷2") }
            Button(onClick = {
                (bpmText.toIntOrNull() ?: 120).let { bpmText = ((it * 2).coerceAtMost(300)).toString() }
            }) { Text("×2") }
        }

        Text("Click volume: ${gainDb.roundToInt()} dB", style = MaterialTheme.typography.labelLarge)
        Slider(value = gainDb, onValueChange = { gainDb = it }, valueRange = -20f..0f)

        Button(
            onClick = { vm.regen(bpmText.toDoubleOrNull(), gainDb.toDouble()) },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Apply BPM / click volume")
        }

        if (urlBacking != null) TrackPlayerCard("Backing (no drums)", urlBacking, "backing")
        if (urlMixed != null) TrackPlayerCard("Mixed (backing + click)", urlMixed, "mixed")

        if (state.error != null) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Text(state.error, Modifier.padding(12.dp), color = MaterialTheme.colorScheme.onErrorContainer)
            }
        }

        Button(onClick = { vm.backToHome() }, modifier = Modifier.fillMaxWidth()) {
            Text("Start another track")
        }
    }
}