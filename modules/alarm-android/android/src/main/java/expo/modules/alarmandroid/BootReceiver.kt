package expo.modules.alarmandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
        intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED) return
    Log.i("BootReceiver", "Boot completed, re-scheduling alarms")
    val storage = AlarmStorage(context)
    val scheduler = AlarmScheduler(context)
    storage.getAll().forEach { entry ->
      runCatching { scheduler.schedule(entry) }
        .onFailure { Log.w("BootReceiver", "Failed to re-schedule ${entry.id}", it) }
    }
  }
}
