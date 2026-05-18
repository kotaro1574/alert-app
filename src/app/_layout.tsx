import '../../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { createScheduler } from '@/services/createScheduler';
import { getStore } from '@/stores/appStore';

export default function RootLayout() {
  useEffect(() => {
    async function init() {
      const scheduler = createScheduler();
      await scheduler.requestAuthorization().catch(() => {});
      const store = await getStore();
      await store.getState().loadAlarms();
    }
    init();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="alarm/[id]"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
