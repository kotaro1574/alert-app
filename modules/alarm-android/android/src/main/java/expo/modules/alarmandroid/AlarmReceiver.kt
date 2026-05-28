package expo.modules.alarmandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID) ?: return
    Log.i("AlarmReceiver", "Alarm fired for id=$id")

    scheduleNextIfRepeating(context, id)

    val serviceIntent = Intent(context, AlarmService::class.java).apply {
      putExtra(Constants.EXTRA_ALARM_ID, id)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }

    AlarmEvents.flow.tryEmit(AlarmStateEvent(id, "fired"))
  }

  private fun scheduleNextIfRepeating(context: Context, id: String) {
    val storage = AlarmStorage(context)
    val entry = storage.get(id) ?: return
    if (entry.weekdays.isEmpty()) {
      storage.remove(id)
      return
    }
    AlarmScheduler(context).schedule(entry)
  }
}
