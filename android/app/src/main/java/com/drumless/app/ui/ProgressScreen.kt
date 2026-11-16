package com.drumless.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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

@Composable
fun ProgressScreen(vm: MainViewModel, state: UiState) {
    val job = state.job
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "Processing track",
            style = MaterialTheme.typography.displaySmall,
            color = Color(0xFFECE9F7)
        )
        Text(
            "This includes AI stem separation, so it can take minutes on CPU.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFA8A2C8)
        )

        LinearProgressIndicator(
            progress = { (job?.progress ?: 0).coerceIn(0, 100) / 100f },
            modifier = Modifier.fillMaxWidth()
        )
        Text(
            job?.message ?: "Queued…",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFA8A2C8)
        )

        if (state.jobId != null) {
            Text(
                "Job ${state.jobId}",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFFA8A2C8)
            )
        }

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
    }
}