import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth, authFlags } from '@/context/auth';
import { NavBar } from '@/components/nav-bar';
import { Spinner, C } from '@/components/ui';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Protected pages: logged-out users leave. An intentional logout goes to the
  // landing page; an expired session goes to Login.
  React.useEffect(() => {
    if (!loading && !user) {
      if (authFlags.logoutIntent) {
        authFlags.logoutIntent = false;
        router.replace('/');
      } else {
        router.replace('/auth/login' as any);
      }
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner label={loading ? 'Loading...' : 'Redirecting to login...'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.aliceBlue }}>
      <NavBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.aliceBlue },
        }}
      >
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="search" />
        <Stack.Screen name="history" />
        <Stack.Screen name="prescribe" />
        <Stack.Screen name="patients" />
        <Stack.Screen name="patients/[fileId]" />
        <Stack.Screen name="prescriptions/index" />
        <Stack.Screen name="prescription/[id]" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="admin/approvals" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/management" />
      </Stack>
    </View>
  );
}
