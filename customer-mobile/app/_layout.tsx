import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
