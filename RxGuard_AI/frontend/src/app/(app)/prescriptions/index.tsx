import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api, imageUrl } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Alert, Badge, Button, Card, C, EmptyState, Input, LoadingPanel, PageHeader, PageShell, SectionTitle, useConfirm } from '@/components/ui';

interface Prescription {
  prescription_id: string;
  title: string;
  details: string | null;
  file_name: string | null;
  mime_type: string | null;
  status: string;
  created_at: string;
}


const DATE_PREFIX = '[rxdate:';
function parseDate(details: string | null): { date: string | null; rest: string } {
  if (!details) return { date: null, rest: '' };
  const m = details.match(/^\[rxdate:(\d{4}-\d{2}-\d{2})\]\s?([\s\S]*)$/);
  if (m) return { date: m[1], rest: m[2] };
  return { date: null, rest: details };
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MyPrescriptionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Prescription[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [rxDate, setRxDate] = useState(todayStr());
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860;
  const gridMaxHeight = Math.max(280, Math.min(560, (height || 800) - 360));
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ prescriptions: Prescription[] }>('/prescriptions/patient');
      setItems(res.prescriptions);
    } catch (e: any) {
      setError(e.message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = () => {
    // Create a temporary file input on web and click it
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => onFileChosen(e);
      input.click();
    }
  };

  const onFileChosen = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, etc.).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(String(reader.result));
      setImageName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) return setError('Please give your prescription a name.');

    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      const combinedDetails = `${DATE_PREFIX}${rxDate}] ${details.trim()}`.trim();
      form.append('details', combinedDetails);
      if (imageBase64) {
        // Convert data URL to Blob for upload
        const res = await fetch(imageBase64);
        const blob = await res.blob();
        form.append('image', blob, imageName || 'prescription.jpg');
      }
      await api.upload('/prescriptions/patient', form);
      setSuccess('Prescription saved to your dashboard.');
      setTitle('');
      setDetails('');
      setRxDate(todayStr());
      setImageBase64(null);
      setImageName(null);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await ask({
      title: 'Delete Prescription',
      message: 'Are you sure you want to delete this prescription?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/prescriptions/patient/${id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (items === null) {
    return <PageShell><LoadingPanel label="Loading your prescription records…" /></PageShell>;
  }

  return (
    <PageShell>
      {dialog}
      <PageHeader eyebrow="Personal records" title="My prescription records" subtitle="Save a photo and notes for your own records. Images are stored for viewing; they are not converted into text." actions={<Button title={showForm ? 'Close form' : 'Save a record'} onPress={() => setShowForm(!showForm)} />} />

      {error ? <Alert tone="error" title="Unable to update records" message={error} /> : null}
      {success ? <Alert tone="success" message={success} /> : null}

      {showForm ? (
        <Card elevated>
          <SectionTitle subtitle="Add a name, a date, optional notes, and an optional image.">Save a prescription record</SectionTitle>
          <View style={{ gap: 12, marginTop: 12 }}>
            <Input label="Filename (your name for this prescription)" value={title} onChangeText={setTitle} placeholder="e.g. June Checkup 2025" autoCapitalize="words" />
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Date of prescription</Text>
              <input
                type="date"
                value={rxDate}
                onChange={(e: any) => setRxDate(e.target.value)}
                max={todayStr()}
                style={{
                  border: `1px solid ${C.borderStrong}`,
                  borderRadius: 11,
                  padding: '11px 12px',
                  fontSize: 14,
                  backgroundColor: C.white,
                  color: C.text,
                  width: '100%',
                  minHeight: 44,
                  boxSizing: 'border-box' as any,
                }}
              />
            </View>
            <Input label="Notes (optional)" value={details} onChangeText={setDetails} placeholder="Medicines, dosage notes..." multiline />
      
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Prescription Photo</Text>
              <Button title={imageBase64 ? 'Photo attached \u2713 \u2014 Choose another' : 'Upload a Photo'} variant="secondary" onPress={pickImage} />
              <Text style={styles.fileHint}>{imageName ? `Selected: ${imageName}` : 'JPG or PNG image. This is stored as an image only.'}</Text>
            </View>
      
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={busy ? 'Saving...' : 'Save Prescription'} onPress={save} loading={busy} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 0, paddingHorizontal: 20 }} />
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={styles.recordsCard}>
        <SectionTitle subtitle="Select a record to view its uploaded image.">{items.length} saved prescription record{items.length === 1 ? '' : 's'}</SectionTitle>
        <ScrollView style={{ maxHeight: gridMaxHeight }} contentContainerStyle={[styles.grid, isMobile && { flexDirection: 'column' }]} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <EmptyState title="No prescription records yet." subtitle="Save a photo or notes to keep your first personal record here." action={<Button title="Save a record" size="sm" onPress={() => setShowForm(true)} />} />
          ) : (
            items.map((p) => {
              const { date } = parseDate(p.details);
              return (
                <View key={p.prescription_id} style={styles.prescCard}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`View ${p.title}`} style={({ pressed }) => [styles.thumbWrap, pressed && styles.pressed]} onPress={() => p.file_name && setViewImage(imageUrl(p.prescription_id))}>
                    <View style={styles.thumbWrap}>
                      {p.file_name ? (
                        <img src={imageUrl(p.prescription_id)} style={styles.thumb} alt={p.title} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Text style={styles.thumbIcon}>\u211E</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.recordCopy}>
                    <Text style={styles.prescTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.prescDate}>
                      {date ? `Rx date: ${new Date(date).toLocaleDateString()}` : `Uploaded: ${new Date(p.created_at).toLocaleDateString()}`}
                    </Text>
                    {p.details ? (() => {
                      const { rest } = parseDate(p.details);
                      return rest.trim() ? <Text style={styles.prescNotes} numberOfLines={2}>{rest}</Text> : null;
                    })() : null}
                    <View style={styles.recordActions}>
                      <Badge status={p.status} small />
                      <View style={{ flex: 1 }} />
                      {p.file_name ? <Button title="View" size="sm" variant="ghost" onPress={() => setViewImage(imageUrl(p.prescription_id))} /> : null}
                      <Button title="Delete" size="sm" variant="ghost" onPress={() => remove(p.prescription_id)} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </Card>
      
      {/* Full-size image viewer */}
      {viewImage ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
          <Pressable style={styles.viewerOverlay} onPress={() => setViewImage(null)}>
            <img src={viewImage} style={styles.viewerImage} alt="Full prescription" />
            <Pressable style={styles.viewerClose} onPress={() => setViewImage(null)}>
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 16 }}>\u2715 Close</Text>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '800', color: C.text },
  fileHint: { fontSize: 11.5, color: C.textSecondary, lineHeight: 17 },
  recordsCard: { paddingBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  prescCard: { width: 190, gap: 8, padding: 10, borderRadius: 15, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border },
  thumbWrap: { borderRadius: 11, overflow: 'hidden' },
  thumb: { width: '100%', height: 130, borderRadius: 11, objectFit: 'cover' as any, backgroundColor: C.gray100 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.border },
  thumbIcon: { fontSize: 39, color: C.primaryDark, fontWeight: '900' },
  recordCopy: { gap: 4, paddingHorizontal: 2 },
  prescTitle: { fontSize: 13.5, fontWeight: '900', color: C.text },
  prescDate: { fontSize: 11.5, color: C.textSecondary },
  prescNotes: { fontSize: 11, color: C.textSecondary, lineHeight: 15 },
  recordActions: { flexDirection: 'row', gap: 2, alignItems: 'center', marginTop: 3 },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(7,25,45,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  viewerImage: { maxWidth: '90%', maxHeight: '85vh', borderRadius: 14, objectFit: 'contain' as any } as any,
  viewerClose: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
