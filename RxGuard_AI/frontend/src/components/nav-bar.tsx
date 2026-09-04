import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/context/auth';
import { C } from '@/components/ui';

interface NavItem {
  label: string;
  href: string;
}

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = width < 860;

  const role = user?.role;
  let items: NavItem[] = [];
  if (role === 'patient') {
    items = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Search', href: '/search' },
      { label: 'My Prescriptions', href: '/prescriptions' },
      { label: 'View Search History', href: '/history' },
    ];
  } else if (role === 'doctor') {
    items = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Search', href: '/search' },
      { label: 'Prescribe New Patient', href: '/prescribe' },
      { label: 'Past Prescriptions', href: '/patients' },
      { label: 'View Search History', href: '/history' },
    ];
  } else if (role === 'admin') {
    items = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Medicines', href: '/admin' },
      { label: 'Doctor Approvals', href: '/admin/approvals' },
      { label: 'Users', href: '/admin/users' },
      { label: 'Management', href: '/admin/management' },
      { label: 'View Search History', href: '/history' },
    ];
  }

  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href as any);
  };

  const doLogout = () => {
    setMenuOpen(false);
    // Navigate away BEFORE clearing the session so the (app) auth guard
    // does not race us to /auth/login — logout should end on the landing page.
    router.replace('/');
    logout();
  };

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Pressable onPress={() => go('/dashboard')} style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>Rx</Text>
          </View>
          <Text style={styles.brandText}>RxGuard AI</Text>
        </Pressable>

        {!isMobile ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navItems}>
            {items.map((it) => {
              const active = pathname.startsWith(it.href);
              return (
                <Pressable key={it.href} onPress={() => go(it.href)} style={[styles.navBtn, active && styles.navBtnActive]}>
                  <Text style={[styles.navBtnText, active && styles.navBtnTextActive]}>{it.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.right}>
          {!isMobile ? (
            <View style={styles.userBox}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.full_name || user?.email}
              </Text>
              <Text style={styles.userRole}>{roleLabel}</Text>
            </View>
          ) : null}
          <Pressable onPress={doLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
          {isMobile ? (
            <Pressable onPress={() => setMenuOpen(!menuOpen)} style={styles.menuBtn} accessibilityLabel="Menu">
              <Text style={styles.menuIcon}>{menuOpen ? '✕' : '☰'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isMobile && menuOpen ? (
        <View style={styles.mobileMenu}>
          <View style={styles.mobileUserInfo}>
            <Text style={styles.userName}>{user?.full_name || user?.email}</Text>
            <Text style={styles.userRole}>{roleLabel}</Text>
          </View>
          {items.map((it) => {
            const active = pathname.startsWith(it.href);
            return (
              <Pressable key={it.href} onPress={() => go(it.href)} style={[styles.mobileItem, active && { backgroundColor: C.aliceBlue }]}>
                <Text style={[styles.mobileItemText, active && { color: C.primary, fontWeight: '700' }]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: C.white, fontWeight: '800', fontSize: 14 },
  brandText: { fontWeight: '800', fontSize: 17, color: C.text },
  navItems: { gap: 2, alignItems: 'center' },
  navBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  navBtnActive: { backgroundColor: C.aliceBlue },
  navBtnText: { color: C.textSecondary, fontWeight: '600', fontSize: 13 },
  navBtnTextActive: { color: C.primary },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  userBox: { alignItems: 'flex-end', marginRight: 4 },
  userName: { fontWeight: '700', fontSize: 13, color: C.text },
  userRole: { fontSize: 11, color: C.primary, textTransform: 'capitalize', fontWeight: '600' },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.red,
    backgroundColor: C.white,
  },
  logoutText: { color: C.red, fontWeight: '700', fontSize: 13 },
  menuBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.gray100 },
  menuIcon: { fontSize: 18, color: C.text },
  mobileMenu: { paddingHorizontal: 16, paddingBottom: 14, gap: 2, borderTopWidth: 1, borderTopColor: C.border },
  mobileUserInfo: { paddingVertical: 8, gap: 2 },
  mobileItem: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
  mobileItemText: { color: C.text, fontSize: 15, fontWeight: '500' },
});
