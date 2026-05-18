import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import type { Alarm, Weekday } from '@/domain/types';

const DAY_LABEL: Record<Weekday, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface Props {
  alarm: Alarm;
  onToggle: (enabled: boolean) => void;
  onPress: () => void;
}

export function AlarmListItem({ alarm, onToggle, onPress }: Props) {
  const weekdayText = alarm.weekdays.map((w) => DAY_LABEL[w]).join(' ');

  return (
    <Pressable
      testID="alarm-list-item"
      onPress={onPress}
      className="border-border flex-row items-center justify-between border-b px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-4xl font-thin text-white">
          {formatTime(alarm.hour, alarm.minute)}
        </Text>
        <Text className="text-secondary mt-0.5 text-sm">{alarm.label}</Text>
        {weekdayText.length > 0 && (
          <Text className="text-secondary mt-0.5 text-xs">{weekdayText}</Text>
        )}
      </View>
      <Switch
        value={alarm.enabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
      />
    </Pressable>
  );
}
