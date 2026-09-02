package com.drumless.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ProgressScreen(vm: MainViewModel, state: UiState) {
    val job = state.job
    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("Processing track", style = MaterialTheme.typography.headlineSmall)
        Text("This includes AI stem separation, so it can take minutes on CPU.", style = MaterialTheme.typography.bodyMedium)

        LinearProgressIndicator(
            progress = { (job?.progress ?: 0).coerceIn(0, 100) / 100f },
            modifier = Modifier.fillMaxWidth(),
        )
        Text(job?.message ?: "Queued…", style = MaterialTheme.typography.bodyMedium)
        if (state.jobId != null) {
            Text("Job ${state.jobId}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }

        if (state.error != null) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Text(state.error, Modifier.padding(12.dp), color = MaterialTheme.colorScheme.onErrorContainer)
            }
        }
    }
}