package expo.modules.alarmandroid

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

class AlarmService : Service() {
  private var mediaPlayer: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var currentAlarmId: String? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.action
    val id = intent?.getStringExtra(Constants.EXTRA_ALARM_ID)
    Log.i("AlarmService", "onStartCommand action=$action id=$id")

    when (action) {
      Constants.ACTION_SERVICE_STOP -> {
        stopAlarm()
        return START_NOT_STICKY
      }
      Constants.ACTION_SERVICE_SNOOZE -> {
        if (id != null) snoozeAlarm(id)
        return START_NOT_STICKY
      }
      else -> {
        if (id != null) startAlarm(id)
        return START_STICKY
      }
    }
  }

  private fun startAlarm(id: String) {
    currentAlarmId = id
    val notif = buildNotification(id)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        Constants.ONGOING_NOTIFICATION_ID,
        notif,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(Constants.ONGOING_NOTIFICATION_ID, notif)
    }
    acquireWakeLock()
    playSound()
  }

  private fun stopAlarm() {
    releaseMediaPlayer()
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun snoozeAlarm(id: String) {
    val nextTrigger = System.currentTimeMillis() + Constants.SNOOZE_DURATION_MS
    AlarmScheduler(applicationContext).scheduleOneShot(id, nextTrigger)
    stopAlarm()
  }

  private fun playSound() {
    val soundUri: Uri = Uri.parse("android.resource://$packageName/raw/alarm")
    mediaPlayer = MediaPlayer().apply {
      try {
        setDataSource(applicationContext, soundUri)
      } catch (e: Exception) {
        Log.w("AlarmService", "Failed to load bundled sound, falling back to default", e)
        setDataSource(applicationContext, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
      }
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      isLooping = true
      setOnPreparedListener { start() }
      prepareAsync()
    }
  }

  private fun releaseMediaPlayer() {
    mediaPlayer?.apply {
      try { if (isPlaying) stop() } catch (_: Exception) {}
      release()
    }
    mediaPlayer = null
  }

  private fun acquireWakeLock() {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "alarmandroid:alarm").apply {
      acquire(10 * 60 * 1000L)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private fun buildNotification(id: String): Notification {
    val entry = AlarmStorage(this).get(id)
    val activityIntent = Intent(this, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
      putExtra(Constants.EXTRA_ALARM_ID, id)
      putExtra("label", entry?.label ?: "アラーム")
    }
    val fullScreenIntent = PendingIntent.getActivity(
      this, id.hashCode(), activityIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return Notification.Builder(this, Constants.NOTIFICATION_CHANNEL_ID)
      .setContentTitle("アラーム")
      .setContentText(entry?.label ?: id)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setCategory(Notification.CATEGORY_ALARM)
      .setOngoing(true)
      .setFullScreenIntent(fullScreenIntent, true)
      .build()
  }

  private fun createNotificationChannel() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(Constants.NOTIFICATION_CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      Constants.NOTIFICATION_CHANNEL_ID,
      Constants.NOTIFICATION_CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      setBypassDnd(true)
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      setSound(null, attrs)
    }
    nm.createNotificationChannel(channel)
  }

  override fun onDestroy() {
    releaseMediaPlayer()
    releaseWakeLock()
    super.onDestroy()
  }
}
