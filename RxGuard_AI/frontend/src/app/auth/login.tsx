import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { Alert, Button, Card, C, Input } from '@/components/ui';
import { storage, KEYS } from '@/lib/storage';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(storage.get(KEYS.rememberedEmail) || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!storage.get(KEYS.rememberedEmail));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  useEffect(() => {
    // Flash message left by the registration page (e.g. pending approval notice)
    const flash = storage.get(KEYS.flashMessage);
    if (flash) {
      setSuccess(flash);
      storage.remove(KEYS.flashMessage);
    }
  }, []);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      if (remember) storage.set(KEYS.rememberedEmail, email.trim().toLowerCase());
      else storage.remove(KEYS.rememberedEmail);
      setSuccess('Signed in. Redirecting...');
      if (user.role === 'doctor' && user.approval_status !== 'approved') {
        router.replace('/dashboard' as any);
      } else {
        router.replace('/dashboard' as any);
      }
    } catch (e: any) {
      setError(e.message || 'Invalid email or password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="link" accessibilityLabel="Return to home" onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}>
          <Text style={styles.backText}>← Back to home</Text>
        </Pressable>
        <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>R</Text></View><Text style={styles.brandText}>RxGuard</Text></View>
      </View>
      <View style={[styles.authGrid, !isWide && styles.authGridCompact]}>
        {isWide ? (
          <View style={styles.contextPanel}>
            <Text style={styles.contextKicker}>SECURE WORKSPACE ACCESS</Text>
            <Text style={styles.contextTitle}>Clarity for every medication decision.</Text>
            <Text style={styles.contextBody}>Access the role-aware workspace built for your records, registry search, and medicine safety review.</Text>
            <View style={styles.contextPoints}>
              <ContextPoint text="Search documented medicine information" />
              <ContextPoint text="Review visible safety status and alerts" />
              <ContextPoint text="Continue in your tailored role workspace" />
            </View>
          </View>
        ) : null}
        <Card style={styles.card} elevated>
          <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to your RxGuard workspace.</Text>

          <View style={styles.form}>
            <Input label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" accessibilityLabel="Email address" />
            <Input label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry accessibilityLabel="Password" />

            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember(!remember)} style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}>
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>{remember ? <Text style={styles.checkmark}>✓</Text> : null}</View>
              <Text style={styles.rememberText}>Remember my email on this device</Text>
            </Pressable>

            {error ? <Alert tone="error" title="Unable to sign in" message={error} /> : null}
            {success ? <Alert tone="success" message={success} /> : null}

            <Button title="Sign in" onPress={submit} loading={busy} size="lg" accessibilityLabel="Sign in to RxGuard" />

            <Pressable accessibilityRole="link" onPress={() => router.push('/auth/register' as any)} style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}>
              <Text style={styles.switchText}>New to RxGuard? <Text style={styles.switchLink}>Create an account</Text></Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </View>
  );
}

function ContextPoint({ text }: { text: string }) {
  return <View style={styles.contextPoint}><View style={styles.contextCheck}><Text style={styles.contextCheckText}>✓</Text></View><Text style={styles.contextPointText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue, paddingHorizontal: 24, paddingVertical: 22 },
  topBar: { width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 3 },
  backText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { height: 31, width: 31, borderRadius: 10, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: C.white, fontSize: 14, fontWeight: '900' },
  brandText: { color: C.navy, fontSize: 16, fontWeight: '900' },
  authGrid: { width: '100%', maxWidth: 960, alignSelf: 'center', flex: 1, flexDirection: 'row', alignItems: 'center', gap: 60 },
  authGridCompact: { justifyContent: 'center' },
  contextPanel: { flex: 1, gap: 14, padding: 18 },
  contextKicker: { color: C.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  contextTitle: { color: C.navy, fontSize: 33, lineHeight: 40, letterSpacing: -0.7, fontWeight: '900' },
  contextBody: { color: C.textSecondary, fontSize: 14.5, lineHeight: 22, maxWidth: 390 },
  contextPoints: { marginTop: 8, gap: 12 },
  contextPoint: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  contextCheck: { width: 21, height: 21, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenBg },
  contextCheckText: { color: C.green, fontSize: 11, fontWeight: '900' },
  contextPointText: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  card: { width: '100%', maxWidth: 440, padding: 30 },
  title: { fontSize: 27, fontWeight: '900', color: C.navy, letterSpacing: -0.45 },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 5, lineHeight: 20 },
  form: { gap: 15, marginTop: 22 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingVertical: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: C.white, fontSize: 12, fontWeight: '900' },
  rememberText: { fontSize: 12.5, color: C.textSecondary, fontWeight: '600' },
  switchRow: { alignItems: 'center', paddingVertical: 5 },
  switchText: { fontSize: 13, color: C.textSecondary },
  switchLink: { color: C.primaryDark, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
