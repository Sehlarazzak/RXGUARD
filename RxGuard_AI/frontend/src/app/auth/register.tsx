import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, Role } from '@/context/auth';
import { Alert, Button, Card, C, Input } from '@/components/ui';
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
  const { width } = useWindowDimensions();
  const isMobile = width < 620;

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
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable accessibilityRole="link" accessibilityLabel="Return to home" onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}><Text style={styles.backText}>← Back to home</Text></Pressable>
        <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>R</Text></View><Text style={styles.brandText}>RxGuard</Text></View>
      </View>

      <Card style={styles.card} elevated>
        <Text style={styles.kicker}>CREATE YOUR WORKSPACE</Text>
        <Text accessibilityRole="header" style={styles.title}>Get started with RxGuard</Text>
        <Text style={styles.subtitle}>Choose your role, then enter the details needed to set up your account.</Text>

        <View style={styles.roleSection}>
          <Text style={styles.fieldTitle}>I am joining as a</Text>
          <View style={[styles.roleRow, isMobile && styles.roleRowMobile]}>
            {roles.map((r) => {
              const selected = role === r.key;
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setRole(r.key)}
                  style={({ pressed }) => [styles.roleCard, selected && styles.roleCardActive, pressed && styles.pressed]}
                >
                  <View style={[styles.roleIndicator, selected && styles.roleIndicatorActive]}>{selected ? <View style={styles.roleIndicatorDot} /> : null}</View>
                  <Text style={[styles.roleLabel, selected && styles.roleLabelActive]}>{r.label}</Text>
                  <Text style={styles.roleHint}>{r.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.form}>
          <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
          <Input label="CNIC" hint="Format: XXXXX-XXXXXXX-X" value={cnic} onChangeText={setCnic} placeholder="XXXXX-XXXXXXX-X" keyboardType="phone-pad" />
          <Input label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input label="Phone number (optional)" value={phone} onChangeText={setPhone} placeholder="+92 3XX XXXXXXX" keyboardType="phone-pad" />

          {role === 'doctor' ? (
            <View style={styles.doctorFields}>
              <View style={styles.doctorNotice}><Text style={styles.doctorNoticeTitle}>Doctor verification details</Text><Text style={styles.doctorNoticeText}>Doctor accounts require administrator approval before prescribing is available.</Text></View>
              <Input label="Medical license number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="PMDC-XXXX-XXXXX" />
              <View>
                <Input
                  label="Clinic or hospital name"
                  value={clinicName}
                  onChangeText={(t) => {
                    setClinicName(t);
                    setShowClinicSuggestions(true);
                  }}
                  placeholder="Start typing your workplace..."
                  autoCapitalize="words"
                />
                {showClinicSuggestions && clinicSuggestions.length > 0 ? (
                  <ScrollView style={styles.suggestBox} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {clinicSuggestions.map((s) => (
                      <Pressable key={s} style={({ pressed }) => [styles.suggestItem, pressed && styles.suggestItemPressed]} onPress={() => { setClinicName(s); setShowClinicSuggestions(false); }}>
                        <Text style={styles.suggestText}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </View>
          ) : null}

          <Input label="Password" hint="At least 8 characters with uppercase, lowercase, and a number." value={password} onChangeText={setPassword} placeholder="Create a secure password" secureTextEntry />
          <Input label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry />

          {error ? <Alert tone="error" title="Check your details" message={error} /> : null}
          {success ? <Alert tone="success" message={success} /> : null}

          <Button title="Create account" onPress={submit} loading={busy} size="lg" accessibilityLabel="Create RxGuard account" />

          <Pressable accessibilityRole="link" onPress={() => router.push('/auth/login' as any)} style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Log in</Text></Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue },
  content: { width: '100%', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 },
  topBar: { width: '100%', maxWidth: 680, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 3 },
  backText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { height: 31, width: 31, borderRadius: 10, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: C.white, fontSize: 14, fontWeight: '900' },
  brandText: { color: C.navy, fontSize: 16, fontWeight: '900' },
  card: { width: '100%', maxWidth: 680, padding: 30 },
  kicker: { color: C.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  title: { fontSize: 28, fontWeight: '900', color: C.navy, letterSpacing: -0.55, marginTop: 5 },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 6, lineHeight: 20, maxWidth: 560 },
  roleSection: { marginTop: 23, gap: 9 },
  fieldTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleRowMobile: { flexWrap: 'wrap' },
  roleCard: { flex: 1, minWidth: 150, position: 'relative', borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 13, gap: 5, backgroundColor: C.gray50 },
  roleCardActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  roleIndicator: { position: 'absolute', top: 11, right: 11, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  roleIndicatorActive: { borderColor: C.primary, backgroundColor: C.white },
  roleIndicatorDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: C.primary },
  roleLabel: { fontWeight: '900', fontSize: 14.5, color: C.navy },
  roleLabelActive: { color: C.primaryDark },
  roleHint: { fontSize: 10.5, color: C.textSecondary, lineHeight: 15, paddingRight: 4 },
  form: { gap: 14, marginTop: 22 },
  doctorFields: { gap: 14 },
  doctorNotice: { padding: 12, borderRadius: 12, backgroundColor: C.amberBg, borderWidth: 1, borderColor: '#F2D5A5' },
  doctorNoticeTitle: { color: C.amber, fontWeight: '900', fontSize: 12.5 },
  doctorNoticeText: { color: '#815210', fontSize: 12, lineHeight: 17, marginTop: 3 },
  suggestBox: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginTop: 6, maxHeight: 230, overflow: 'hidden' },
  suggestItem: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  suggestItemPressed: { backgroundColor: C.primaryLight },
  suggestText: { fontSize: 13.5, color: C.text, fontWeight: '600' },
  switchRow: { alignItems: 'center', paddingVertical: 5 },
  switchText: { fontSize: 13, color: C.textSecondary },
  switchLink: { color: C.primaryDark, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
