package expo.modules.alarmandroid

import kotlinx.coroutines.flow.MutableSharedFlow

data class AlarmStateEvent(val id: String, val state: String)

object AlarmEvents {
  val flow = MutableSharedFlow<AlarmStateEvent>(extraBufferCapacity = 16)
}
