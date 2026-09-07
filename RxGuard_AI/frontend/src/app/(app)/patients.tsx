import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Alert, Button, Card, C, EmptyState, Input, LoadingPanel, PageHeader, PageShell, SectionTitle, useConfirm } from '@/components/ui';

interface PatientFile {
  file_id: string;
  patient_name: string;
  created_at: string;
  prescription_count: number;
  last_updated: string | null;
}

export default function PastPrescriptionsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<PatientFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860;
  const gridMaxHeight = Math.max(280, Math.min(560, (height || 800) - 360));
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ files: PatientFile[] }>('/prescriptions/files');
      setFiles(res.files);
    } catch (e: any) {
      setError(e.message);
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteFolder = async (f: PatientFile) => {
    const ok = await ask({
      title: 'Delete Patient File',
      message: `Delete the folder for ${f.patient_name} and all prescriptions in it?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/prescriptions/files/${f.file_id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (files === null) {
    return <PageShell><LoadingPanel label="Loading patient files…" /></PageShell>;
  }

  const visibleFiles = files.filter((file) => file.patient_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <PageShell>
      {dialog}
      <PageHeader eyebrow="Doctor workspace" title="Patient files" subtitle="Saved prescriptions are organized by patient, ready to reopen when you need them." actions={<Button title="New prescription" onPress={() => router.push('/prescribe' as any)} />} />

      {error ? <Alert tone="error" title="Unable to update patient files" message={error} /> : null}

      <Card style={styles.filterCard}>
        <Input label="Find a patient" value={query} onChangeText={setQuery} placeholder="Search by patient name…" />
      </Card>

      <Card style={styles.filesCard}>
        <SectionTitle subtitle={query ? `${visibleFiles.length} matching patient file${visibleFiles.length === 1 ? '' : 's'}` : 'Open a file to review or continue a prescription.'}>{files.length} patient file{files.length === 1 ? '' : 's'}</SectionTitle>
        <ScrollView style={{ maxHeight: gridMaxHeight }} contentContainerStyle={[styles.grid, isMobile && { flexDirection: 'column' }]} showsVerticalScrollIndicator={false}>
          {visibleFiles.length === 0 ? (
            <EmptyState
              title={query ? 'No patient files match that name.' : 'No patient files yet.'}
              subtitle={query ? 'Try a different spelling or clear the search.' : 'Create your first file from the prescribing workspace.'}
              action={!query ? <Button title="Start prescribing" size="sm" onPress={() => router.push('/prescribe' as any)} /> : undefined}
            />
          ) : (
            visibleFiles.map((f) => (
              <View key={f.file_id} style={styles.folderCard}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${f.patient_name} patient file`} style={({ pressed }) => [styles.folderOpen, pressed && styles.pressed]} onPress={() => router.push(`/patients/${f.file_id}` as any)}>
                  <View style={styles.folderIcon}><Text style={styles.folderIconText}>▤</Text></View>
                  <Text style={styles.folderName} numberOfLines={1}>{f.patient_name}</Text>
                  <Text style={styles.folderMeta}>{f.prescription_count} prescription{Number(f.prescription_count) === 1 ? '' : 's'}</Text>
                  <Text style={styles.folderDate}>{f.last_updated ? `Updated ${new Date(f.last_updated).toLocaleDateString()}` : `Created ${new Date(f.created_at).toLocaleDateString()}`}</Text>
                </Pressable>
                <View style={styles.folderActions}><Button title="Open" size="sm" variant="secondary" onPress={() => router.push(`/patients/${f.file_id}` as any)} /><Button title="Delete" size="sm" variant="ghost" onPress={() => deleteFolder(f)} /></View>
              </View>
            ))
          )}
        </ScrollView>
      </Card>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  filterCard: { paddingVertical: 15 },
  filesCard: { paddingBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  folderCard: { width: 218, borderRadius: 15, borderWidth: 1, borderColor: C.border, backgroundColor: C.gray50, padding: 12, gap: 9 },
  folderOpen: { gap: 6 },
  folderIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryLight },
  folderIconText: { color: C.primaryDark, fontWeight: '900', fontSize: 16 },
  folderName: { fontSize: 14.5, fontWeight: '900', color: C.text, marginTop: 2 },
  folderMeta: { fontSize: 11.5, color: C.primaryDark, fontWeight: '800' },
  folderDate: { fontSize: 11, color: C.textSecondary },
  folderActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
