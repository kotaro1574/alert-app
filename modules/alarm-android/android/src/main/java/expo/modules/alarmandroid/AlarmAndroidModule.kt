package expo.modules.alarmandroid

import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class AlarmAndroidModule : Module() {
  private var eventCollectorJob: Job? = null
  private val moduleScope = CoroutineScope(Dispatchers.Main)

  override fun definition() = ModuleDefinition {
    Name("AlarmAndroid")
    Events("onAlarmStateChanged")

    OnCreate {
      eventCollectorJob = moduleScope.launch {
        AlarmEvents.flow.collect { event ->
          this@AlarmAndroidModule.sendEvent(
            "onAlarmStateChanged",
            bundleOf("id" to event.id, "state" to event.state)
          )
        }
      }
    }

    OnDestroy {
      eventCollectorJob?.cancel()
      eventCollectorJob = null
    }

    AsyncFunction("schedule") { id: String, hour: Int, minute: Int,
                                weekdays: List<Int>, label: String,
                                snoozeEnabled: Boolean ->
      val entry = AlarmEntry(id, hour, minute, weekdays, label, snoozeEnabled)
      AlarmScheduler(context).schedule(entry)
    }

    AsyncFunction("cancel") { id: String ->
      AlarmScheduler(context).cancel(id)
    }

    AsyncFunction("list") {
      AlarmScheduler(context).list()
    }

    AsyncFunction("requestPermissions") {
      PermissionHelper.requestAll(context, currentActivity)
    }
  }

  private val context get() = requireNotNull(appContext.reactContext)
  private val currentActivity get() = appContext.activityProvider?.currentActivity
}
