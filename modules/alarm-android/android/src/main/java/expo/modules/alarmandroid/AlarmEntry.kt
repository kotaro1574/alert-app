package expo.modules.alarmandroid

import kotlinx.serialization.Serializable

@Serializable
data class AlarmEntry(
  val id: String,
  val hour: Int,
  val minute: Int,
  val weekdays: List<Int>, // ISO-8601: 1=Mon..7=Sun, empty = one-shot
  val label: String,
  val snoozeEnabled: Boolean,
)
