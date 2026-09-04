import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { Button, Card, C, Input } from '@/components/ui';
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
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>← Back to home</Text>
      </Pressable>
      <Card style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your RxGuard AI account</Text>

        <View style={{ gap: 14, marginTop: 18 }}>
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

          <Pressable onPress={() => setRemember(!remember)} style={styles.rememberRow}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Remember my email</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <Button title={busy ? 'Signing in...' : 'Login'} onPress={submit} loading={busy} />

          <Pressable onPress={() => router.push('/auth/register' as any)} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Don&apos;t have an account? <Text style={styles.switchLink}>Create one</Text>
            </Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backLink: { position: 'absolute', top: 30, left: 24 },
  backText: { color: C.primary, fontWeight: '600', fontSize: 14 },
  card: { width: '100%', maxWidth: 440, padding: 28 },
  title: { fontSize: 26, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.primary },
  checkmark: { color: C.white, fontSize: 12, fontWeight: '800' },
  rememberText: { fontSize: 14, color: C.textSecondary },
  error: { color: C.red, fontSize: 13.5, backgroundColor: C.redBg, padding: 10, borderRadius: 10 },
  success: { color: C.green, fontSize: 13.5, backgroundColor: C.greenBg, padding: 10, borderRadius: 10 },
  switchRow: { alignItems: 'center', paddingVertical: 6 },
  switchText: { fontSize: 14, color: C.textSecondary },
  switchLink: { color: C.primary, fontWeight: '700' },
});
