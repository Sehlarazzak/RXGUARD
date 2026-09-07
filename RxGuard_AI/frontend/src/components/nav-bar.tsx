import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/context/auth';
import { C } from '@/components/ui';

interface NavItem {
  label: string;
  href: string;
  glyph: string;
}

function itemsForRole(role: string | null | undefined): NavItem[] {
  if (role === 'patient') {
    return [
      { label: 'Overview', href: '/dashboard', glyph: '⌂' },
      { label: 'Find medicine', href: '/search', glyph: '⌕' },
      { label: 'My records', href: '/prescriptions', glyph: '▤' },
      { label: 'History', href: '/history', glyph: '◷' },
    ];
  }
  if (role === 'doctor') {
    return [
      { label: 'Overview', href: '/dashboard', glyph: '⌂' },
      { label: 'Find medicine', href: '/search', glyph: '⌕' },
      { label: 'Prescribe', href: '/prescribe', glyph: '✎' },
      { label: 'Patient files', href: '/patients', glyph: '▤' },
      { label: 'History', href: '/history', glyph: '◷' },
    ];
  }
  return [
    { label: 'Overview', href: '/dashboard', glyph: '⌂' },
    { label: 'Registry', href: '/admin', glyph: '▦' },
    { label: 'Approvals', href: '/admin/approvals', glyph: '✓' },
    { label: 'Users', href: '/admin/users', glyph: '◉' },
    { label: 'Management', href: '/admin/management', glyph: '⚙' },
    { label: 'History', href: '/history', glyph: '◷' },
  ];
}

function isRouteActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const isCompact = width < 980;
  const items = useMemo(() => itemsForRole(user?.role), [user?.role]);
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Account';
  const initials = (user?.full_name || user?.email || 'Rx')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const go = (href: string) => {
    setMenuOpen(false);
    if (!isRouteActive(pathname, href)) router.push(href as any);
  };

  const doLogout = () => {
    setMenuOpen(false);
    router.replace('/');
    logout();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="link" accessibilityLabel="Go to dashboard" onPress={() => go('/dashboard')} style={({ pressed }) => [styles.brand, pressed && styles.pressed]}>
          <View style={styles.logo}><Text style={styles.logoMark}>R</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandText}>RxGuard</Text>
            <Text style={styles.brandTag}>SAFETY INTELLIGENCE</Text>
          </View>
        </Pressable>

        {!isCompact ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navItems} keyboardShouldPersistTaps="handled">
            {items.map((item) => {
              const active = isRouteActive(pathname, item.href);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={item.label}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [styles.navBtn, active && styles.navBtnActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.navGlyph, active && styles.navBtnTextActive]}>{item.glyph}</Text>
                  <Text style={[styles.navBtnText, active && styles.navBtnTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.right}>
          {!isCompact ? (
            <View style={styles.userBox}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <View style={styles.userCopy}>
                <Text style={styles.userName} numberOfLines={1}>{user?.full_name || user?.email}</Text>
                <Text style={styles.userRole}>{roleLabel} workspace</Text>
              </View>
            </View>
          ) : null}
          {!isCompact ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={doLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((open) => !open)}
              style={({ pressed }) => [styles.menuBtn, menuOpen && styles.menuBtnOpen, pressed && styles.pressed]}
            >
              <Text style={styles.menuIcon}>{menuOpen ? '×' : '☰'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isCompact && menuOpen ? (
        <View style={styles.mobilePanel}>
          <View style={styles.mobileIdentity}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{user?.full_name || user?.email}</Text>
              <Text style={styles.userRole}>{roleLabel} workspace</Text>
            </View>
          </View>
          <View style={styles.mobileLinks}>
            {items.map((item) => {
              const active = isRouteActive(pathname, item.href);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [styles.mobileItem, active && styles.mobileItemActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.mobileGlyph, active && styles.navBtnTextActive]}>{item.glyph}</Text>
                  <Text style={[styles.mobileItemText, active && styles.navBtnTextActive]}>{item.label}</Text>
                  {active ? <View style={styles.activeMarker} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={doLogout} style={({ pressed }) => [styles.mobileLogout, pressed && styles.pressed]}>
            <Text style={styles.mobileLogoutText}>Log out of RxGuard</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 20 },
  bar: { flexDirection: 'row', alignItems: 'center', maxWidth: 1280, width: '100%', alignSelf: 'center', paddingHorizontal: 24, minHeight: 70, gap: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', shadowColor: C.navy, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  logoMark: { color: C.white, fontWeight: '900', fontSize: 17 },
  brandCopy: { gap: 1 },
  brandText: { fontWeight: '900', fontSize: 17, color: C.navy, letterSpacing: -0.3 },
  brandTag: { fontSize: 7.5, fontWeight: '800', letterSpacing: 1, color: C.primary },
  navItems: { gap: 3, alignItems: 'center', paddingVertical: 8 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  navBtnActive: { backgroundColor: C.primaryLight, borderColor: '#CBE5F8' },
  navGlyph: { color: C.textSecondary, fontSize: 14, fontWeight: '700' },
  navBtnText: { color: C.textSecondary, fontWeight: '700', fontSize: 12.5 },
  navBtnTextActive: { color: C.primaryDark },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 210 },
  avatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.primaryDark, fontSize: 11, fontWeight: '900' },
  userCopy: { gap: 1, flexShrink: 1 },
  userName: { fontWeight: '800', fontSize: 12.5, color: C.text },
  userRole: { fontSize: 10.5, color: C.textSecondary, textTransform: 'capitalize' },
  logoutBtn: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  logoutText: { color: C.textSecondary, fontWeight: '800', fontSize: 12 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.gray100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  menuBtnOpen: { backgroundColor: C.primaryLight, borderColor: '#B9DDF5' },
  menuIcon: { color: C.navy, fontSize: 21, fontWeight: '600' },
  mobilePanel: { paddingHorizontal: 18, paddingBottom: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.white, gap: 12 },
  mobileIdentity: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 10, borderRadius: 13, backgroundColor: C.gray50 },
  mobileLinks: { gap: 3 },
  mobileItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: 11 },
  mobileItemActive: { backgroundColor: C.primaryLight },
  mobileGlyph: { color: C.textSecondary, fontSize: 15, width: 18, textAlign: 'center' },
  mobileItemText: { color: C.text, fontWeight: '700', fontSize: 14, flex: 1 },
  activeMarker: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary },
  mobileLogout: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#F0C4CA', backgroundColor: C.redBg },
  mobileLogoutText: { color: C.red, fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});
