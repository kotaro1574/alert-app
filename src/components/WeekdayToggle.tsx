import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ALL_WEEKDAYS } from '@/domain/types';
import type { Weekday } from '@/domain/types';

const DAY_LABEL: Record<Weekday, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

interface Props {
  value: readonly Weekday[];
  onChange: (days: Weekday[]) => void;
}

export function WeekdayToggle({ value, onChange }: Props) {
  const toggle = (day: Weekday) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  };

  return (
    <View className="flex-row justify-between px-2">
      {ALL_WEEKDAYS.map((day) => {
        const active = value.includes(day);
        return (
          <Pressable
            key={day}
            role="button"
            onPress={() => toggle(day)}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              active ? 'bg-accent' : 'border border-border bg-surface'
            }`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-black' : 'text-white'}`}>
              {DAY_LABEL[day]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
