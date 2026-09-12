import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="register"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="verify"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="forgot"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="reset"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
