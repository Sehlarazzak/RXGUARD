import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, Role } from '@/context/auth';
import { Button, Card, C, Input } from '@/components/ui';
import { storage, KEYS } from '@/lib/storage';

// Well-known hospitals/clinics for the doctor registration autocomplete
const CLINICS = [
  'Shifa International Hospital',
  'Aga Khan University Hospital',
  'Lahore General Hospital',
  'Services Hospital Lahore',
  'Mayo Hospital Lahore',
  'Jinnah Hospital Lahore',
  'Civil Hospital Karachi',
  'Dow University Hospital',
  'Holy Family Hospital Rawalpindi',
  'Pakistan Institute of Medical Sciences',
  'Nishtar Hospital Multan',
  'Khyber Teaching Hospital Peshawar',
  'Quaid-e-Azam International Hospital',
  'Shaukat Khanum Memorial Hospital',
  'Hameed Latif Hospital',
  'Doctors Hospital Lahore',
  'National Hospital Lahore',
  'Fatima Memorial Hospital',
  'Maroof International Hospital',
  'Shalamar Hospital Lahore',
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<Role>('patient');
  const [fullName, setFullName] = useState('');
  const [cnic, setCnic] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showClinicSuggestions, setShowClinicSuggestions] = useState(false);

  const clinicSuggestions = useMemo(() => {
    if (!clinicName.trim()) return [];
    const q = clinicName.toLowerCase();
    return CLINICS.filter((c) => c.toLowerCase().includes(q)).slice(0, 6);
  }, [clinicName]);

  const submit = async () => {
    setError(null);
    setSuccess(null);

    // Client-side validation mirrors the backend
    if (!fullName.trim()) return setError('Name is required.');
    if (!/^\d{5}-\d{7}-\d$/.test(cnic.trim())) {
      return setError('CNIC must follow the format XXXXX-XXXXXXX-X (13 digits).');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return setError('Password must be at least 8 characters with an uppercase letter, a lowercase letter and a number.');
    }
    if (password !== confirmPassword) return setError('Password and Confirm Password do not match.');
    if (role === 'doctor') {
      if (!licenseNumber.trim()) return setError('Medical License Number is required.');
      if (!clinicName.trim()) return setError('Clinic/Hospital Name is required.');
    }

    setBusy(true);
    try {
      const res = await register({
        role,
        fullName: fullName.trim(),
        cnic: cnic.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        phone: phone.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
      });
      setSuccess(res.message);
      // Show the message on the login page too, so fast redirect can't hide it
      storage.set(KEYS.flashMessage, res.message);
      setTimeout(() => router.replace('/auth/login' as any), 1800);
    } catch (e: any) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const roles: { key: Role; label: string; hint: string }[] = [
    { key: 'patient', label: 'Patient', hint: 'Check medicine safety and manage your prescriptions' },
    { key: 'doctor', label: 'Doctor', hint: 'Write and verify prescriptions with AI safety checks' },
    { key: 'admin', label: 'Admin', hint: 'Manage medicines, users, approvals and audits' },
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>← Back to home</Text>
      </Pressable>

      <Card style={styles.card}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join RxGuard AI — AI-Powered Medication Safety</Text>

        <View style={styles.roleRow}>
          {roles.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRole(r.key)}
              style={[styles.roleCard, role === r.key && styles.roleCardActive]}
            >
              <Text style={[styles.roleLabel, role === r.key && { color: C.primary }]}>{r.label}</Text>
              <Text style={styles.roleHint}>{r.hint}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 13, marginTop: 16 }}>
          <Input label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
          <Input label="CNIC" value={cnic} onChangeText={setCnic} placeholder="XXXXX-XXXXXXX-X" keyboardType="phone-pad" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="+92 3XX XXXXXXX" keyboardType="phone-pad" />

          {role === 'doctor' ? (
            <>
              <Input label="Medical License Number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="PMDC-XXXX-XXXXX" />
              <View style={{ position: 'relative' }}>
                <Input
                  label="Clinic / Hospital Name"
                  value={clinicName}
                  onChangeText={(t) => {
                    setClinicName(t);
                    setShowClinicSuggestions(true);
                  }}
                  placeholder="Start typing your workplace..."
                  autoCapitalize="words"
                />
                {showClinicSuggestions && clinicSuggestions.length > 0 ? (
                  <View style={styles.suggestBox}>
                    {clinicSuggestions.map((s) => (
                      <Pressable
                        key={s}
                        style={styles.suggestItem}
                        onPress={() => {
                          setClinicName(s);
                          setShowClinicSuggestions(false);
                        }}
                      >
                        <Text style={styles.suggestText}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          <Input label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters, mixed case + number" secureTextEntry />
          <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <Button title={busy ? 'Creating account...' : 'Create Account'} onPress={submit} loading={busy} />

          <Pressable onPress={() => router.push('/auth/login' as any)} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Login</Text>
            </Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue },
  content: { alignItems: 'center', padding: 20, paddingTop: 60 },
  backLink: { position: 'absolute', top: 30, left: 24 },
  backText: { color: C.primary, fontWeight: '600', fontSize: 14 },
  card: { width: '100%', maxWidth: 560, padding: 28 },
  title: { fontSize: 26, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  roleCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.border,
    padding: 12,
    gap: 4,
    backgroundColor: C.white,
  },
  roleCardActive: { borderColor: C.primary, backgroundColor: C.aliceBlue },
  roleLabel: { fontWeight: '800', fontSize: 15, color: C.text },
  roleHint: { fontSize: 10.5, color: C.textSecondary, lineHeight: 14 },
  suggestBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    zIndex: 50,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  suggestItem: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  suggestText: { fontSize: 14, color: C.text },
  error: { color: C.red, fontSize: 13.5, backgroundColor: C.redBg, padding: 10, borderRadius: 10 },
  success: { color: C.green, fontSize: 13.5, backgroundColor: C.greenBg, padding: 10, borderRadius: 10 },
  switchRow: { alignItems: 'center', paddingVertical: 6 },
  switchText: { fontSize: 14, color: C.textSecondary },
  switchLink: { color: C.primary, fontWeight: '700' },
});
