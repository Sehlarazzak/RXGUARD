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
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.nav}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
          <View>
            <Text style={styles.brandName}>RxGuard</Text>
            <Text style={styles.brandTag}>SAFETY INTELLIGENCE</Text>
          </View>
        </View>
        <View style={styles.navBtns}>
          <Pressable accessibilityRole="link" accessibilityLabel="Log in to RxGuard" style={({ pressed }) => [styles.loginBtn, pressed && styles.pressed]} onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.loginText}>Log in</Text>
          </Pressable>
          {!isMobile ? <Pressable accessibilityRole="link" style={({ pressed }) => [styles.navCreate, pressed && styles.pressed]} onPress={() => router.push('/auth/register' as any)}><Text style={styles.navCreateText}>Get started</Text></Pressable> : null}
        </View>
      </View>

      <View style={[styles.hero, isMobile && styles.heroMobile]}>
        <View style={styles.heroText}>
          <View style={styles.eyebrow}><View style={styles.eyebrowDot} /><Text style={styles.eyebrowText}>Medication safety workspace</Text></View>
          <Text accessibilityRole="header" style={styles.headline}>Medication safety,{`\n`}made clearer.</Text>
          <Text style={styles.description}>
            Search documented medicine records, review registry safety information, and manage prescription records in one focused workspace.
          </Text>
          <View style={[styles.ctaRow, isMobile && styles.ctaRowMobile]}>
            <Pressable accessibilityRole="link" style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]} onPress={() => router.push('/auth/register' as any)}>
              <Text style={styles.createText}>Create an account</Text><Text style={styles.createArrow}>→</Text>
            </Pressable>
            <Pressable accessibilityRole="link" style={({ pressed }) => [styles.loginGhost, pressed && styles.pressed]} onPress={() => router.push('/auth/login' as any)}>
              <Text style={styles.loginGhostText}>Explore your workspace</Text>
            </Pressable>
          </View>
          <View style={[styles.trustRow, isMobile && styles.trustRowMobile]}>
            <TrustMark label="Registry-aware search" />
            <TrustMark label="Role-specific workspaces" />
            <TrustMark label="Safety status visibility" />
          </View>
        </View>
        <View style={[styles.heroVisual, isMobile && styles.heroVisualMobile]}>
          <View style={styles.visualAccent} />
          <Image
            source={require('@/assets/images/rxguard-hero.png')}
            style={styles.heroImage}
            contentFit="contain"
            accessibilityLabel="RxGuard medication safety interface preview"
          />
          <View style={styles.visualCallout}>
            <View style={styles.calloutIcon}><Text style={styles.calloutIconText}>✓</Text></View>
            <View><Text style={styles.calloutTitle}>Safety information, in context</Text><Text style={styles.calloutSub}>Search, review, and decide with clarity.</Text></View>
          </View>
        </View>
      </View>

      <View style={styles.sectionIntro}>
        <Text style={styles.sectionKicker}>ONE PLATFORM, THREE WORKSPACES</Text>
        <Text style={styles.sectionTitle}>Built around the people who use it.</Text>
      </View>
      <View style={[styles.features, isMobile && styles.featuresMobile]}>
        <FeatureCard icon="⌕" title="Patients" body="Find medicine records, understand displayed safety status, and keep uploaded prescription records organized." />
        <FeatureCard icon="✎" title="Doctors" body="Create patient files, check typed prescriptions against available medicine safety data, and print only after review." />
        <FeatureCard icon="▦" title="Administrators" body="Maintain the registry, review approvals, and manage users with clear operational context." />
      </View>

      <View style={[styles.footer, isMobile && styles.footerMobile]}>
        <Text style={styles.footerBrand}>RxGuard</Text>
        <Text style={styles.footerText}>Medication safety information, presented with clarity.</Text>
      </View>
    </ScrollView>
  );
}

function TrustMark({ label }: { label: string }) {
  return <View style={styles.trustMark}><View style={styles.trustDot} /><Text style={styles.trustText}>{label}</Text></View>;
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}><Text style={styles.featureIconText}>{icon}</Text></View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  content: { maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.aliceBlue },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 21 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 39, height: 39, borderRadius: 13, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: C.white, fontWeight: '900', fontSize: 17 },
  brandName: { fontWeight: '900', fontSize: 19, color: C.navy, letterSpacing: -0.25 },
  brandTag: { fontSize: 7.5, fontWeight: '800', letterSpacing: 1.05, color: C.primary, marginTop: 1 },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  loginBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10 },
  loginText: { color: C.primaryDark, fontWeight: '800', fontSize: 13.5 },
  navCreate: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 10, backgroundColor: C.primary },
  navCreateText: { color: C.white, fontWeight: '800', fontSize: 13 },
  hero: { flexDirection: 'row', gap: 32, alignItems: 'center', padding: 44, backgroundColor: C.navy, borderRadius: 26, overflow: 'hidden' },
  heroMobile: { padding: 25, gap: 26 },
  heroText: { flex: 1, gap: 17, minWidth: 250 },
  eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(103, 185, 232, 0.16)', borderWidth: 1, borderColor: 'rgba(103, 185, 232, 0.28)' },
  eyebrowDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: C.lightBlue },
  eyebrowText: { color: '#C7E8FC', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.35 },
  headline: { fontSize: 45, fontWeight: '900', color: C.white, lineHeight: 51, letterSpacing: -1.3 },
  description: { maxWidth: 575, fontSize: 15.5, color: '#C7D8E8', lineHeight: 24 },
  ctaRow: { flexDirection: 'row', gap: 11, marginTop: 4, flexWrap: 'wrap' },
  ctaRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  createBtn: { minHeight: 51, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 13, backgroundColor: C.lightBlue, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 20 },
  createText: { color: C.navy, fontWeight: '900', fontSize: 14.5 },
  createArrow: { color: C.navy, fontWeight: '900', fontSize: 18 },
  loginGhost: { minHeight: 51, justifyContent: 'center', alignItems: 'center', borderRadius: 13, paddingVertical: 13, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(231, 247, 241, 0.36)' },
  loginGhostText: { color: C.white, fontWeight: '800', fontSize: 14 },
  trustRow: { flexDirection: 'row', gap: 15, marginTop: 5, flexWrap: 'wrap' },
  trustRowMobile: { flexDirection: 'column', gap: 8 },
  trustMark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustDot: { height: 5, width: 5, borderRadius: 3, backgroundColor: C.lightBlue },
  trustText: { color: '#B7CBDE', fontSize: 10.5, fontWeight: '700' },
  heroVisual: { width: 365, height: 330, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  heroVisualMobile: { width: '100%', maxWidth: 365, alignSelf: 'center' },
  visualAccent: { position: 'absolute', width: 278, height: 278, borderRadius: 150, backgroundColor: 'rgba(103, 185, 232, 0.14)', borderWidth: 1, borderColor: 'rgba(103, 185, 232, 0.2)' },
  heroImage: { width: '100%', height: 280 },
  visualCallout: { position: 'absolute', left: 0, bottom: 12, right: 0, flexDirection: 'row', gap: 9, alignItems: 'center', padding: 12, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.95)', shadowColor: C.navy, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  calloutIcon: { height: 30, width: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenBg },
  calloutIconText: { color: C.green, fontSize: 15, fontWeight: '900' },
  calloutTitle: { color: C.navy, fontSize: 11.5, fontWeight: '900' },
  calloutSub: { color: C.textSecondary, fontSize: 10.5, marginTop: 2 },
  sectionIntro: { paddingTop: 54, gap: 5 },
  sectionKicker: { color: C.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  sectionTitle: { color: C.navy, fontSize: 27, fontWeight: '900', letterSpacing: -0.6 },
  features: { flexDirection: 'row', gap: 14, paddingTop: 20 },
  featuresMobile: { flexDirection: 'column' },
  featureCard: { flex: 1, minHeight: 202, padding: 20, gap: 9, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, borderRadius: 19 },
  featureIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  featureIconText: { color: C.primaryDark, fontSize: 17, fontWeight: '900' },
  featureTitle: { fontSize: 17, fontWeight: '900', color: C.navy },
  featureBody: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 44, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 22 },
  footerMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  footerBrand: { color: C.navy, fontWeight: '900', fontSize: 14 },
  footerText: { color: C.textMuted, fontSize: 11.5 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});
