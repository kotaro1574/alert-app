package expo.modules.alarmandroid

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

class AlarmScheduler(private val context: Context) {
  private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private val storage = AlarmStorage(context)

  fun schedule(entry: AlarmEntry) {
    storage.put(entry)
    val triggerAt = computeNextTrigger(System.currentTimeMillis(), entry)
    val pendingIntent = buildPendingIntent(entry.id)
    val showIntent = buildShowIntent()
    alarmManager.setAlarmClock(
      AlarmManager.AlarmClockInfo(triggerAt, showIntent),
      pendingIntent
    )
  }

  fun scheduleOneShot(id: String, triggerAt: Long) {
    val pendingIntent = buildPendingIntent(id)
    val showIntent = buildShowIntent()
    alarmManager.setAlarmClock(
      AlarmManager.AlarmClockInfo(triggerAt, showIntent),
      pendingIntent
    )
  }

  fun cancel(id: String) {
    val pendingIntent = buildPendingIntent(id)
    alarmManager.cancel(pendingIntent)
    storage.remove(id)
  }

  fun list(): List<Map<String, Any>> {
    return storage.getAll().map {
      mapOf("id" to it.id, "nextTriggerAt" to computeNextTrigger(System.currentTimeMillis(), it))
    }
  }

  private fun buildPendingIntent(id: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = Constants.ACTION_ALARM_FIRE
      putExtra(Constants.EXTRA_ALARM_ID, id)
    }
    return PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun buildShowIntent(): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  companion object {
    fun computeNextTrigger(now: Long, entry: AlarmEntry): Long {
      val cal = Calendar.getInstance().apply {
        timeInMillis = now
        set(Calendar.HOUR_OF_DAY, entry.hour)
        set(Calendar.MINUTE, entry.minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (entry.weekdays.isEmpty()) {
        if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
      }
      val isoWeekdays = entry.weekdays.toSet()
      repeat(8) { offset ->
        val candidate = Calendar.getInstance().apply {
          timeInMillis = cal.timeInMillis
          add(Calendar.DAY_OF_YEAR, offset)
        }
        val iso = ((candidate.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1
        if (iso in isoWeekdays && candidate.timeInMillis > now) return candidate.timeInMillis
      }
      return cal.timeInMillis
    }
  }
}
