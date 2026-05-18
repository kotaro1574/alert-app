import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmListItem } from '@/components/AlarmListItem';
import { getStore } from '@/stores/appStore';
import type { Alarm } from '@/domain/types';

export default function ListScreen() {
  const router = useRouter();
  const [alarms, setAlarms] = useState<readonly Alarm[]>([]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    getStore().then((store) => {
      setAlarms(store.getState().alarms);
      unsub = store.subscribe((state) => setAlarms(state.alarms));
    });
    return () => {
      unsub?.();
    };
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    const store = await getStore();
    await store.getState().toggleAlarm(id, enabled);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-2xl font-semibold text-white">アラーム</Text>
        <Pressable
          accessibilityLabel="アラームを追加"
          onPress={() => router.push('/alarm/new')}
          className="h-8 w-8 items-center justify-center rounded-full bg-accent"
        >
          <Text className="text-xl font-bold text-black">+</Text>
        </Pressable>
      </View>

      <FlatList
        data={[...alarms]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlarmListItem
            alarm={item}
            onToggle={(enabled) => handleToggle(item.id, enabled)}
            onPress={() => router.push(`/alarm/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-32">
            <Text className="text-base text-secondary">アラームがありません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
