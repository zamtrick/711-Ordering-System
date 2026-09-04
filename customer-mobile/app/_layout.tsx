import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CartProvider } from "@/context/CartContext";

export default function RootLayout() {
  return (
    <CartProvider>
      <StatusBar style="dark" />

      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      </Stack>
    </CartProvider>
  );
}
