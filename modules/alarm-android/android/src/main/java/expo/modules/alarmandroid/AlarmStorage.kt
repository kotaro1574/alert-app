package expo.modules.alarmandroid

import android.content.Context
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AlarmStorage(context: Context) {
  private val prefs = context.getSharedPreferences(
    context.packageName + Constants.PREFS_NAME_SUFFIX,
    Context.MODE_PRIVATE
  )

  fun put(entry: AlarmEntry) {
    prefs.edit().putString(entry.id, Json.encodeToString(entry)).commit()
  }

  fun get(id: String): AlarmEntry? {
    val raw = prefs.getString(id, null) ?: return null
    return runCatching { Json.decodeFromString<AlarmEntry>(raw) }.getOrNull()
  }

  fun remove(id: String) {
    prefs.edit().remove(id).commit()
  }

  fun getAll(): List<AlarmEntry> {
    return prefs.all.values.filterIsInstance<String>().mapNotNull {
      runCatching { Json.decodeFromString<AlarmEntry>(it) }.getOrNull()
    }
  }
}
