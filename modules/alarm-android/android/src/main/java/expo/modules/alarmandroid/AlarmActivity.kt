package expo.modules.alarmandroid

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

class AlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      km.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }

    setContentView(R.layout.activity_alarm)

    val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID) ?: ""
    val label = intent.getStringExtra("label") ?: "アラーム"
    findViewById<TextView>(R.id.labelText).text = label

    findViewById<Button>(R.id.stopButton).setOnClickListener {
      sendToService(Constants.ACTION_SERVICE_STOP, id)
      finishAndRemoveTask()
    }
    findViewById<Button>(R.id.snoozeButton).setOnClickListener {
      sendToService(Constants.ACTION_SERVICE_SNOOZE, id)
      finishAndRemoveTask()
    }
  }

  private fun sendToService(action: String, id: String) {
    val intent = Intent(this, AlarmService::class.java).apply {
      this.action = action
      putExtra(Constants.EXTRA_ALARM_ID, id)
    }
    startService(intent)
  }
}
