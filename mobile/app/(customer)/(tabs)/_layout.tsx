import { Stack } from 'expo-router';

/**
 * The web app owns the whole customer experience (including its own
 * responsive bottom nav) inside WebAppShell — no native tab bar layered
 * on top, so the app matches the web app 1:1.
 */
export default function CustomerTabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
