import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, C, EmptyState, PageHeader, PageShell, SectionTitle, Spinner, useConfirm } from '@/components/ui';

type Tab = 'manufacturers' | 'sources' | 'backups' | 'events';

export default function AdminManagementPage() {
  const [tab, setTab] = useState<Tab>('manufacturers');
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Administration"
        title="Registry operations"
        subtitle="Maintain manufacturer details, review source records, create manual backups, and inspect the immutable event trail."
      />

      <View style={[styles.tabs, isMobile && { flexWrap: 'wrap' }]}> 
        {(
          [
            ['manufacturers', 'Manufacturers'],
            ['sources', 'DRAP Sources'],
            ['backups', 'Backups'],
            ['events', 'Admin Events'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === value }}
            style={[styles.tab, tab === value && styles.tabActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, tab === value && { color: C.primary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'manufacturers' ? <ManufacturersTab /> : null}
      {tab === 'sources' ? <SourcesTab /> : null}
      {tab === 'backups' ? <BackupsTab /> : null}
      {tab === 'events' ? <EventsTab /> : null}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Manufacturers
// ---------------------------------------------------------------------------
function ManufacturersTab() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ manufacturers: any[] }>('/admin/manufacturers');
      setRows(res.manufacturers);
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (m: any) => {
    setEditing(m);
    setLegalName(m.legal_name || '');
    setCountry(m.country || '');
    setAddress(m.address || '');
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/admin/manufacturers/${editing.manufacturer_id}`, {
        legal_name: legalName.trim() || undefined,
        country: country.trim() || undefined,
        address: address.trim() || undefined,
      });
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevated>
      {error ? <Alert tone="error" title="Could not load manufacturers" message={error} /> : null}
      <SectionTitle subtitle="Edit the registry manufacturer profile without changing linked records.">{rows === null ? 'Loading manufacturers…' : `${rows.length} manufacturers`}</SectionTitle>
      {rows === null ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner /></View>
      ) : (
        <View style={{ gap: 8, marginTop: 12 }}>
          {rows.map((m) => (
            <View key={m.manufacturer_id} style={styles.listRow}>
              <View style={{ flex: 1, gap: 2, minWidth: 180 }}>
                <Text style={styles.rowTitle}>{m.legal_name}</Text>
                <Text style={styles.rowMeta}>
                  {m.country || '—'} · {m.product_count} product{Number(m.product_count) === 1 ? '' : 's'}
                </Text>
                {m.address ? <Text style={styles.rowSub} numberOfLines={1}>{m.address}</Text> : null}
              </View>
              <Button title="Edit" size="sm" variant="secondary" onPress={() => openEdit(m)} />
            </View>
          ))}
        </View>
      )}

      {editing ? (
        <View style={styles.editBox}>
          <Text style={styles.editTitle}>Edit manufacturer</Text>
          <TextInput value={legalName} onChangeText={setLegalName} placeholder="Legal name" placeholderTextColor="#9CA3AF" style={styles.editInput} />
          <TextInput value={country} onChangeText={setCountry} placeholder="Country" placeholderTextColor="#9CA3AF" style={styles.editInput} />
          <TextInput value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor="#9CA3AF" multiline style={[styles.editInput, { height: 70, textAlignVertical: 'top' }]} />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button title="Save changes" size="sm" loading={saving} onPress={save} />
            <Button title="Cancel" size="sm" variant="secondary" onPress={() => setEditing(null)} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DRAP sources
// ---------------------------------------------------------------------------
function SourcesTab() {
  const [sources, setSources] = useState<any[] | null>(null);
  const [documents, setDocuments] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ sources: any[] }>('/admin/sources'),
      api.get<{ documents: any[] }>('/admin/documents'),
    ])
      .then(([s, d]) => {
        setSources(s.sources);
        setDocuments(d.documents);
      })
      .catch((e: any) => {
        setError(e.message);
        setSources([]);
        setDocuments([]);
      });
  }, []);

  return (
    <View style={{ gap: 14 }}>
      {error ? <Alert tone="error" title="Could not load source records" message={error} /> : null}
      <Card elevated>
        <SectionTitle>Registered sources</SectionTitle>
        {sources === null ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner /></View>
        ) : sources.length === 0 ? (
          <EmptyState title="No sources registered." />
        ) : (
          <View style={{ gap: 8, marginTop: 12 }}>
            {sources.map((s) => (
              <View key={s.source_id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.source_name}</Text>
                  <Text style={styles.rowMeta}>
                    {s.source_type || '—'} · {s.document_count} document{Number(s.document_count) === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card elevated>
        <SectionTitle subtitle="Open a source title to view its canonical reference.">Source documents</SectionTitle>
        {documents === null ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner /></View>
        ) : documents.length === 0 ? (
          <EmptyState title="No source documents." />
        ) : (
          <ScrollView horizontal style={{ marginTop: 10 }}>
            <View style={{ gap: 6, minWidth: 600 }}>
              <View style={[styles.docHeaderRow, { backgroundColor: C.aliceBlue }]}>
                <Text style={[styles.docHeaderCell, { flex: 2 }]}>Title</Text>
                <Text style={[styles.docHeaderCell, { flex: 1 }]}>Source</Text>
                <Text style={styles.docHeaderCell}>Published</Text>
              </View>
              {documents.map((d: any) => (
                <Pressable
                  key={d.document_id}
                  style={styles.docHeaderRow}
                  onPress={() => d.canonical_url && typeof window !== 'undefined' && window.open(d.canonical_url, '_blank')}
                >
                  <Text style={[styles.docCell, { flex: 2, color: d.canonical_url ? C.primary : C.text }]} numberOfLines={1}>
                    {d.title || 'Untitled'}
                  </Text>
                  <Text style={[styles.docCell, { flex: 1 }]} numberOfLines={1}>{d.source_name}</Text>
                  <Text style={styles.docCell}>
                    {d.publication_date ? new Date(d.publication_date).toLocaleDateString() : '—'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------
function BackupsTab() {
  const [backups, setBackups] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ backups: any[] }>('/admin/backups');
      setBackups(res.backups);
    } catch (e: any) {
      setError(e.message);
      setBackups([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createBackup = async () => {
    const ok = await ask({
      title: 'Create backup',
      message: 'Dump all medicine registry and app tables into a timestamped JSON backup file?',
      confirmLabel: 'Create backup',
    });
    if (!ok) return;
    setCreating(true);
    setMessage(null);
    try {
      const res = await api.post<{ backup: any }>('/admin/backups', {});
      setMessage(`Backup created: ${res.backup.file_name} (${formatSize(res.backup.file_size)})`);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card elevated>
      {dialog}
      {error ? <Alert tone="error" title="Backup creation failed" message={error} /> : null}
      {message ? <Alert tone="success" title="Backup created" message={message} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SectionTitle>{backups === null ? 'Backups' : `${backups.length} backup${backups.length === 1 ? '' : 's'}`}</SectionTitle>
        <Button title="Create manual backup" onPress={createBackup} loading={creating} />
      </View>
      <Text style={styles.rowMeta}>Each backup dumps the full registry + app data to a JSON file on the server and is logged in the audit trail.</Text>
      {backups === null ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner /></View>
      ) : backups.length === 0 ? (
        <View style={{ marginTop: 10 }}><EmptyState title="No backups yet." subtitle="Create the first manual backup above." /></View>
      ) : (
        <View style={{ gap: 8, marginTop: 12 }}>
          {backups.map((b) => (
            <View key={b.backup_id} style={styles.listRow}>
              <View style={{ flex: 1, gap: 2, minWidth: 180 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{b.file_name}</Text>
                <Text style={styles.rowMeta}>
                  {new Date(b.created_at).toLocaleString()} · {b.triggered_by_name || 'admin'}
                </Text>
              </View>
              <Badge status={b.status === 'success' ? 'safe' : b.status} small />
              {b.file_size ? <Text style={styles.rowSub}>{formatSize(b.file_size)}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Admin events (immutable audit trail)
// ---------------------------------------------------------------------------
function EventsTab() {
  const [events, setEvents] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ events: any[] }>('/admin/events')
      .then((r) => setEvents(r.events))
      .catch((e: any) => {
        setError(e.message);
        setEvents([]);
      });
  }, []);

  return (
    <Card elevated>
      {error ? <Alert tone="error" title="Could not load admin events" message={error} /> : null}
      <SectionTitle subtitle="Read-only audit entries for administrative actions.">Admin event audit trail</SectionTitle>
      <Text style={styles.rowMeta}>Immutable log of every administrative action (read-only).</Text>
      {events === null ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner /></View>
      ) : events.length === 0 ? (
        <View style={{ marginTop: 10 }}><EmptyState title="No admin events yet." /></View>
      ) : (
        <View style={{ gap: 8, marginTop: 12 }}>
          {events.map((e) => (
            <View key={e.event_id} style={styles.eventRow}>
              <View style={styles.eventRail}>
                <View style={[styles.eventDot, { backgroundColor: eventColor(e.action) }]} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eventAction}>{String(e.action).replace(/_/g, ' ')}</Text>
                {e.details ? (
                  <Text style={styles.eventDetails} numberOfLines={2}>
                    {typeof e.details === 'string' ? e.details : JSON.stringify(e.details)}
                  </Text>
                ) : null}
                <Text style={styles.eventMeta}>
                  {e.actor || e.actor_email || 'system'} · {new Date(e.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function eventColor(action: string): string {
  if (action?.includes('approved')) return C.green;
  if (action?.includes('reject') || action?.includes('deactivat')) return C.red;
  if (action?.includes('backup')) return '#0891B2';
  if (action?.includes('safety')) return C.amber;
  return C.primary;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  tabActive: { backgroundColor: C.aliceBlue, borderColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: C.gray50,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  rowMeta: { fontSize: 12, color: C.textSecondary },
  rowSub: { fontSize: 11.5, color: C.textSecondary },
  editBox: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    backgroundColor: C.aliceBlue,
  },
  editTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  editInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: C.white,
    color: C.text,
  },
  docHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  docHeaderCell: { fontSize: 11.5, fontWeight: '800', color: C.primaryDark, textTransform: 'uppercase' },
  docCell: { fontSize: 12.5, color: C.text, flexShrink: 1 },
  eventRow: { flexDirection: 'row' },
  eventRail: { width: 16, alignItems: 'center', paddingTop: 6 },
  eventDot: { width: 9, height: 9, borderRadius: 5 },
  eventAction: { fontSize: 13.5, fontWeight: '800', color: C.text, textTransform: 'capitalize' },
  eventDetails: { fontSize: 12, color: C.textSecondary, lineHeight: 17 },
  eventMeta: { fontSize: 11.5, color: C.textSecondary },
});
