package expo.modules.alarmandroid

object Constants {
  const val PREFS_NAME_SUFFIX = ".alarms"
  const val NOTIFICATION_CHANNEL_ID = "alarm_channel"
  const val NOTIFICATION_CHANNEL_NAME = "Alarms"
  const val ONGOING_NOTIFICATION_ID = 42
  const val SNOOZE_DURATION_MS = 540_000L

  const val ACTION_ALARM_FIRE = "expo.modules.alarmandroid.FIRE"
  const val EXTRA_ALARM_ID = "alarm_id"

  const val ACTION_SERVICE_STOP = "expo.modules.alarmandroid.STOP"
  const val ACTION_SERVICE_SNOOZE = "expo.modules.alarmandroid.SNOOZE"
}
