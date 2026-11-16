package com.drumless.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
fun HomeScreen(vm: MainViewModel, state: UiState) {
    var urlInput by remember { mutableStateOf("") }
    var pickedName by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            pickedName = uri.lastPathSegment
            vm.submitFile(uri)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "Drumless",
            style = MaterialTheme.typography.headlineLarge,
            color = Color(0xFFECE9F7)
        )
        Text(
            "Remove the drums, lock a click to the detected tempo, and practice. " +
                "Processing happens on your backend server - this app talks to it.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFA8A2C8)
        )

        OutlinedTextField(
            value = urlInput,
            onValueChange = { urlInput = it },
            label = { Text("YouTube URL (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = {
                vm.submitUrl(urlInput)
                urlInput = ""
            },
            enabled = urlInput.isNotBlank() && !state.submitting,
            modifier = Modifier.fillMaxWidth(),
            content = {
                Text("Process YouTube URL")
            }
        )

        OutlinedButton(
            onClick = { picker.launch("audio/*") },
            enabled = !state.submitting,
            modifier = Modifier.fillMaxWidth(),
            content = {
                Text(pickedName?.let { "Processing “$it”…" } ?: "Pick audio file")
            }
        )

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