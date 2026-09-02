package com.drumless.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.drumless.app.ui.HomeScreen
import com.drumless.app.ui.MainViewModel
import com.drumless.app.ui.ProgressScreen
import com.drumless.app.ui.ResultsScreen
import com.drumless.app.ui.Screen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme()) {
                DrumlessApp()
            }
        }
    }
}

@Composable
fun DrumlessApp(vm: MainViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    Surface(modifier = Modifier.fillMaxSize()) {
        when (state.screen) {
            Screen.Home -> HomeScreen(vm, state)
            Screen.Progress -> ProgressScreen(vm, state)
            Screen.Results -> ResultsScreen(vm, state)
        }
    }
}