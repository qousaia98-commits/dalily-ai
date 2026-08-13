import { Stack } from 'expo-router';

/**
 * The web app owns the whole business/provider experience (including its
 * own responsive nav) inside WebAppShell — no native tab bar layered on
 * top, so the app matches the web app 1:1.
 */
export default function ProviderTabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
