import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/context/auth';
import { C, Spinner } from '@/components/ui';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  // Logged-in users land straight on their dashboard
  React.useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard' as any);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner label="Loading RxGuard AI..." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.nav}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>Rx</Text>
          </View>
          <Text style={styles.brandName}>RxGuard AI</Text>
        </View>
        <View style={styles.navBtns}>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.loginText}>Login</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.hero, isMobile && { flexDirection: 'column' }]}>
        <View style={styles.heroText}>
          <Text style={styles.headline}>Helping your diagnosis</Text>
          <Text style={styles.description}>
            RxGuard AI is an AI-powered medication safety platform for patients, doctors and pharmacists.
            Track discontinued, recalled and reformulated medicines, verify prescriptions against live DRAP
            safety data, and discover safe alternatives — all in one place.
          </Text>
          <View style={[styles.ctaRow, isMobile && { flexDirection: 'column' }]}>
            <Pressable style={styles.createBtn} onPress={() => router.push('/auth/register' as any)}>
              <Text style={styles.createText}>Create Account</Text>
            </Pressable>
            <Pressable style={styles.loginGhost} onPress={() => router.push('/auth/login' as any)}>
              <Text style={styles.loginGhostText}>Login</Text>
            </Pressable>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>52+</Text>
              <Text style={styles.statLabel}>Medicines tracked</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>7</Text>
              <Text style={styles.statLabel}>DRAP safety alerts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>31</Text>
              <Text style={styles.statLabel}>Recalled batches</Text>
            </View>
          </View>
        </View>
        <Image
          source={require('@/assets/images/rxguard-hero.png')}
          style={isMobile ? styles.heroImageMobile : styles.heroImage}
          contentFit="contain"
        />
      </View>

      <View style={[styles.features, isMobile && { flexDirection: 'column' }]}>
        <FeatureCard
          title="For Patients"
          body="Check if your medicines are safe, view ingredients and manufacturers, find nearby retailers and keep your prescriptions organised."
        />
        <FeatureCard
          title="For Doctors"
          body="Type prescriptions on the notepad, get instant safety verification, swap unsafe medicines for AI-ranked alternatives, then print with confidence."
        />
        <FeatureCard
          title="For Pharmacists & Admins"
          body="Centralised DRAP registry with relationship maps, batch tracking, source documents and a complete audit trail."
        />
      </View>

      <Text style={styles.footer}>RxGuard AI — AI-Powered Medication Safety Platform</Text>
    </ScrollView>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  content: { maxWidth: 1100, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: C.white, fontWeight: '800', fontSize: 16 },
  brandName: { fontWeight: '800', fontSize: 20, color: C.text },
  navBtns: { flexDirection: 'row', gap: 10 },
  loginBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  loginText: { color: C.primary, fontWeight: '700', fontSize: 15 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
    paddingVertical: 30,
    borderRadius: 24,
    marginVertical: 10,
  },
  heroText: { flex: 1, gap: 16 },
  headline: { fontSize: 42, fontStyle: 'italic', fontWeight: '800', color: C.primary, lineHeight: 50 },
  description: { fontSize: 16, color: C.textSecondary, lineHeight: 25 },
  ctaRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  createBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 30,
    shadowColor: C.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  createText: { color: C.white, fontWeight: '800', fontSize: 16 },
  loginGhost: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderWidth: 2,
    borderColor: C.primary,
  },
  loginGhostText: { color: C.primary, fontWeight: '800', fontSize: 16 },
  statsRow: { flexDirection: 'row', gap: 30, marginTop: 16 },
  stat: { gap: 2 },
  statNum: { fontSize: 24, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 12, color: C.textSecondary },
  heroImage: { width: 420, height: 340 },
  heroImageMobile: { width: '100%', height: 220, marginTop: 6 },
  features: { flexDirection: 'row', gap: 16, paddingVertical: 20 },
  featureCard: {
    flex: 1,
    backgroundColor: C.aliceBlue,
    borderRadius: 18,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  featureTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  featureBody: { fontSize: 13.5, color: C.textSecondary, lineHeight: 20 },
  footer: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 24 },
});
