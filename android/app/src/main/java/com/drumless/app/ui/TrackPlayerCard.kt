package com.drumless.app.ui

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.drumless.app.util.Downloads
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

@Composable
fun TrackPlayerCard(title: String, url: String, filename: String) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
        }
    }

    var isPlaying by remember { mutableStateOf(false) }
    var positionSec by remember { mutableStateOf(0) }
    var durationSec by remember { mutableStateOf(0) }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (player.duration > 0) durationSec = (player.duration / 1000).toInt()
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            positionSec = (player.currentPosition / 1000).toInt()
            delay(500)
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF14112A),
            contentColor = Color(0xFFECE9F7)
        )
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFFECE9F7)
            )

            if (durationSec > 0) {
                Slider(value = positionSec.toFloat(), onValueChange = { player.seekTo((it * 1000).toLong()) }, valueRange = 0f..durationSec.toFloat())
                val m = { s: Int -> "%d:%02d".format(s / 60, s % 60) }
                Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${m(positionSec)}", style = MaterialTheme.typography.bodySmall, color = Color(0xFFA8A2C8))
                    Text("${m(durationSec)}", style = MaterialTheme.typography.bodySmall, color = Color(0xFFA8A2C8))
                }
            }

            Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = { if (isPlaying) player.pause() else player.play() }) {
                    Text(if (isPlaying) "Pause" else "Play")
                }
                Button(onClick = {
                    scope.launch {
                        Downloads.save(context, url, filename)
                        Toast.makeText(context, "Saved to Music/Drumless", Toast.LENGTH_SHORT).show()
                    }
                }) {
                    Text("Save")
                }
            }
        }
    }
}