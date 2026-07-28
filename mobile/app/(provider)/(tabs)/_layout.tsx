import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      variant="caption"
      style={{ color: focused ? colors.primary : colors.textMuted, fontWeight: '700' }}
    >
      {label}
    </Text>
  );
}

export default function ProviderTabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('providerApp.tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('providerApp.tabs.jobs'),
          tabBarIcon: ({ focused }) => <TabIcon label="☰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('providerApp.tabs.calendar'),
          tabBarIcon: ({ focused }) => <TabIcon label="▦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('providerApp.tabs.messages'),
          tabBarIcon: ({ focused }) => <TabIcon label="✉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('providerApp.tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon label="☺" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
