import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ListScreen() {
  const router = useRouter();

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
        data={[]}
        keyExtractor={(item: never) => item}
        renderItem={() => null}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-32">
            <Text className="text-base text-secondary">アラームがありません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
