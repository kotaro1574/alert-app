package expo.modules.alarmandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID)
    Log.i("AlarmReceiver", "Alarm fired for id=$id action=${intent.action}")
  }
}
