package com.drumless.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

@Composable
fun ResultsScreen(vm: MainViewModel, state: UiState) {
    val job = state.job ?: run { vm.backToHome(); return }

    var bpmText by remember(job.bpm) { mutableStateOf((job.bpm?.roundToInt() ?: 120).toString()) }
    var gainDb by remember { mutableStateOf(6f) }

    val base = remember(state.baseUrl) { state.baseUrl.trimEnd('/') }
    val urlBacking = job.files["backing"]?.let { base + it }
    val urlMixed = job.files["mixed"]?.let { base + it }

    Column(
        modifier = Modifier
            .fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "Results",
            style = MaterialTheme.typography.displayMedium,
            color = Color(0xFFECE9F7)
        )
        Text(
            "Detected tempo: ${job.bpm?.roundToInt() ?: "?"} BPM " +
                "(source: ${job.tempoSource ?: "?"})",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFA8A2C8)
        )

        OutlinedTextField(
            value = bpmText,
            onValueChange = { bpmText = it },
            label = { Text("BPM (editable)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                (bpmText.toIntOrNull() ?: 120).let { bpmText = ((it / 2).coerceAtLeast(30)).toString() }
            }) {
                Text("÷2")
            }
            Button(onClick = {
                (bpmText.toIntOrNull() ?: 120).let { bpmText = ((it * 2).coerceAtMost(300)).toString() }
            }) {
                Text("×2")
            }
        }

        Text(
            "Click volume: ${gainDb.roundToInt()} dB",
            style = MaterialTheme.typography.labelLarge,
            color = Color(0xFFFFB544)
        )

        Slider(value = gainDb, onValueChange = { gainDb = it }, valueRange = -20f..6f)

        Button(onClick = { vm.regen(bpmText.toDoubleOrNull(), gainDb.toDouble()) }, modifier = Modifier.fillMaxWidth()) {
            Text("Apply BPM / click volume")
        }

        if (urlBacking != null) TrackPlayerCard("Backing (no drums)", urlBacking, "backing")
        if (urlMixed != null) TrackPlayerCard("Mixed (backing + click)", urlMixed, "mixed")

        if (state.error != null) {
            Card(
                modifier = Modifier.padding(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFFFF7A7A),
                    contentColor = Color(0xFF1A1205)
                )
            ) {
                Text(state.error, color = Color(0xFF1A1205))
            }
        }

        Button(onClick = { vm.backToHome() }, modifier = Modifier.fillMaxWidth()) {
            Text("Start another track")
        }
    }
}