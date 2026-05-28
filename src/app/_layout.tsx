import '../../global.css';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { createScheduler } from '@/services/createScheduler';
import { getStore } from '@/stores/appStore';

export default function RootLayout() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function init() {
      const scheduler = createScheduler();
      await scheduler.requestAuthorization().catch(() => {});
      const store = await getStore();
      await store.getState().loadAlarms();
    }
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (wasBackground && next === 'active') {
        const scheduler = createScheduler();
        await scheduler.requestAuthorization().catch(() => {});
      }
    });
    return () => sub.remove();
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
