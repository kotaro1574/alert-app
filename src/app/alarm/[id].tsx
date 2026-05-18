import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeekdayToggle } from '@/components/WeekdayToggle';
import { getStore } from '@/stores/appStore';
import { colors } from '@/theme/colors';
import type { Weekday } from '@/domain/types';

function buildInitialDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [date, setDate] = useState<Date>(buildInitialDate(7, 0));
  const [label, setLabel] = useState('');
  const [weekdays, setWeekdays] = useState<readonly Weekday[]>([]);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);

  useEffect(() => {
    if (isNew) return;
    getStore().then(async (store) => {
      const alarm = store.getState().alarms.find((a) => a.id === id);
      if (!alarm) return;
      setDate(buildInitialDate(alarm.hour, alarm.minute));
      setLabel(alarm.label);
      setWeekdays(alarm.weekdays);
      setSnoozeEnabled(alarm.snoozeEnabled);
    });
  }, [id, isNew]);

  const handleSave = async () => {
    const store = await getStore();
    const input = {
      label,
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekdays,
      enabled: true,
      snoozeEnabled,
      soundId: 'default' as const,
    };
    if (isNew) {
      await store.getState().addAlarm(input);
    } else {
      await store.getState().updateAlarm(id, input);
    }
    router.back();
  };

  const handleDelete = async () => {
    const store = await getStore();
    await store.getState().deleteAlarm(id);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-accent">キャンセル</Text>
        </Pressable>
        <Text className="text-base font-semibold text-white">
          {isNew ? 'アラームを追加' : 'アラームを編集'}
        </Text>
        <Pressable onPress={handleSave}>
          <Text className="text-base font-semibold text-accent">保存</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        <View className="items-center py-6">
          <DateTimePicker
            value={date}
            mode="time"
            display="spinner"
            onChange={(_event, selected) => selected && setDate(selected)}
            textColor={colors.text}
            style={{ height: 200 }}
          />
        </View>

        <View className="mx-4 mb-4 rounded-xl bg-surface px-4 py-3">
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="ラベル"
            placeholderTextColor={colors.textSecondary}
            className="text-base text-white"
            maxLength={100}
          />
        </View>

        <View className="mx-4 mb-4 rounded-xl bg-surface px-4 py-4">
          <Text className="mb-3 text-sm text-secondary">曜日</Text>
          <WeekdayToggle value={weekdays} onChange={setWeekdays} />
        </View>

        <View className="mx-4 mb-4 flex-row items-center justify-between rounded-xl bg-surface px-4 py-3">
          <Text className="text-base text-white">スヌーズ</Text>
          <Switch
            value={snoozeEnabled}
            onValueChange={setSnoozeEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.text}
          />
        </View>

        {!isNew && (
          <Pressable onPress={handleDelete} className="mx-4 mb-8 rounded-xl bg-surface px-4 py-3">
            <Text className="text-center text-base text-danger">アラームを削除</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
