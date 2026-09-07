import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, C, EmptyState, PageHeader, PageShell, SectionTitle, Spinner, useConfirm } from '@/components/ui';

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string;
  cnic: string | null;
  phone: string | null;
  license_number: string | null;
  clinic_name: string | null;
  approval_status: string;
  is_active: boolean;
  created_at: string;
  role: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setUsers(null);
    try {
      const p = new URLSearchParams();
      if (debounced) p.set('search', debounced);
      if (roleFilter) p.set('role', roleFilter);
      if (approvalFilter) p.set('approval', approvalFilter);
      const res = await api.get<{ users: AdminUser[] }>(`/admin/users?${p.toString()}`);
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message);
      setUsers([]);
    }
  }, [debounced, roleFilter, approvalFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (u: AdminUser) => {
    const ok = await ask({
      title: u.is_active ? 'Deactivate account' : 'Activate account',
      message: `${u.is_active ? 'Deactivate' : 'Activate'} the account of ${u.full_name}?`,
      confirmLabel: u.is_active ? 'Deactivate' : 'Activate',
      danger: u.is_active,
    });
    if (!ok) return;
    setBusyId(u.user_id);
    try {
      await api.post(`/admin/users/${u.user_id}/toggle`, {});
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const roleTabs = [
    { value: '', label: 'All roles' },
    { value: 'patient', label: 'Patients' },
    { value: 'doctor', label: 'Doctors' },
    { value: 'admin', label: 'Admins' },
  ];

  return (
    <PageShell>
      {dialog}
      <PageHeader
        eyebrow="Administration"
        title="User access"
        subtitle="Search registered accounts, filter by role, and manage activation status."
      />

      {error ? <Alert tone="error" title="Could not update users" message={error} action={<Button title="Retry" size="sm" variant="secondary" onPress={load} />} /> : null}

      <Card style={{ gap: 12 }} elevated>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, CNIC or clinic..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>
        <View style={[styles.roleTabs, isMobile && { flexWrap: 'wrap' }]}>
          {roleTabs.map((t) => (
            <Pressable
              key={t.value}
              accessibilityRole="button"
              accessibilityState={{ selected: roleFilter === t.value }}
              style={[styles.roleTab, roleFilter === t.value && styles.roleTabActive]}
              onPress={() => setRoleFilter(t.value)}
            >
              <Text style={[styles.roleTabText, roleFilter === t.value && { color: C.primary }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: approvalFilter === 'pending' }}
            style={[styles.roleTab, approvalFilter === 'pending' && styles.roleTabActive]}
            onPress={() => setApprovalFilter(approvalFilter === 'pending' ? '' : 'pending')}
          >
            <Text style={[styles.roleTabText, approvalFilter === 'pending' && { color: C.primary }]}>
              Pending approval
            </Text>
          </Pressable>
        </View>
      </Card>

      <Card elevated>
        <SectionTitle subtitle="Activation changes take effect immediately.">{users === null ? 'Loading accounts…' : `${users.length} user${users.length === 1 ? '' : 's'}`}</SectionTitle>
        {users === null ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner /></View>
        ) : users.length === 0 ? (
          <View style={{ marginTop: 10 }}>
            <EmptyState title="No users match your search." />
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
            {users.map((u) => (
              <View key={u.user_id} style={styles.userCard}>
                <View style={[styles.userRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, gap: 5, minWidth: 220 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={styles.name}>{u.full_name}</Text>
                      <Badge status={u.role} small />
                      {u.role === 'doctor' ? <Badge status={u.approval_status} small /> : null}
                      {!u.is_active ? (
                        <View style={styles.inactiveChip}>
                          <Text style={styles.inactiveChipText}>deactivated</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.meta}>{u.email}</Text>
                    <Text style={styles.sub}>
                      CNIC: {u.cnic || '—'}
                      {u.clinic_name ? ` · Clinic: ${u.clinic_name}` : ''}
                      {u.license_number ? ` · License: ${u.license_number}` : ''}
                    </Text>
                    <Text style={styles.date}>Joined {new Date(u.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Button
                    title={u.is_active ? 'Deactivate' : 'Activate'}
                    variant={u.is_active ? 'danger' : 'success'}
                    size="sm"
                    loading={busyId === u.user_id}
                    disabled={busyId !== null && busyId !== u.user_id}
                    onPress={() => toggleActive(u)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: C.white,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 11, color: C.text },
  roleTabs: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  roleTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
  },
  roleTabActive: { backgroundColor: C.aliceBlue, borderColor: C.primary },
  roleTabText: { fontSize: 12.5, fontWeight: '700', color: C.textSecondary },
  userCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.gray50,
    padding: 14,
  },
  userRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { fontSize: 15.5, fontWeight: '800', color: C.text },
  meta: { fontSize: 13, color: C.textSecondary },
  sub: { fontSize: 12, color: C.textSecondary },
  date: { fontSize: 11.5, color: C.textSecondary },
  inactiveChip: { backgroundColor: C.gray100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  inactiveChipText: { fontSize: 10, color: C.textSecondary, fontWeight: '700' },
});
