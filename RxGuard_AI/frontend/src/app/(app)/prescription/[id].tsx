import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, imageUrl } from '@/lib/api';
import { Badge, Button, Card, C, EmptyState, LoadingPanel, PageHeader, PageShell, SectionTitle } from '@/components/ui';

export default function PrescriptionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [prescription, setPrescription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/prescriptions/patient/${id}`)
      .then((r: any) => setPrescription(r.prescription))
      .catch((e: any) => setError(e.message));
  }, [id]);

  if (error) {
    return <PageShell><EmptyState title="Prescription record unavailable" subtitle={error} action={<Button title="Back to records" variant="secondary" onPress={() => router.push('/prescriptions' as any)} />} /></PageShell>;
  }
  if (!prescription) {
    return <PageShell><LoadingPanel label="Loading your prescription record…" /></PageShell>;
  }

  return (
    <PageShell>
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={() => router.push('/prescriptions' as any)}>
        <Text style={styles.backText}>← Back to prescription records</Text>
      </Pressable>

      <PageHeader eyebrow="Personal prescription record" title={prescription.title} subtitle={`Created ${new Date(prescription.created_at).toLocaleString()}`} actions={<Badge status={prescription.status} />} />

      <Card>
        <SectionTitle subtitle="The uploaded image is stored for viewing only and is not converted into text.">Prescription image</SectionTitle>
        <View style={{ marginTop: 12 }}>
          {prescription.file_name && !imgFailed ? (
            <img
              src={imageUrl(prescription.prescription_id)}
              style={styles.image as any}
              alt={prescription.title}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderIcon}>℞</Text>
              <Text style={styles.placeholderText}>
                {prescription.file_name ? 'Image not found' : 'No image was uploaded for this prescription'}
              </Text>
            </View>
          )}
        </View>
      </Card>

      {prescription.details ? (
        <Card>
          <SectionTitle>Notes</SectionTitle>
          <Text style={styles.detailsText}>{prescription.details}</Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle subtitle="Basic metadata for this saved record.">Record information</SectionTitle>
        <View style={{ gap: 8, marginTop: 10 }}>
          <InfoRow label="File name" value={prescription.file_name || '—'} />
          <InfoRow label="Status" value={prescription.status} />
          <InfoRow label="Created" value={new Date(prescription.created_at).toLocaleString()} />
          <InfoRow label="Last updated" value={new Date(prescription.updated_at).toLocaleString()} />
        </View>
      </Card>
    </PageShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  image: { width: '100%', minHeight: 320, borderRadius: 14, objectFit: 'contain' as any, backgroundColor: C.gray50 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', paddingVertical: 60 },
  placeholderIcon: { fontSize: 45, color: C.primaryDark },
  placeholderText: { fontSize: 13, color: C.textSecondary, textAlign: 'center' },
  detailsText: { fontSize: 14, color: C.text, lineHeight: 22, marginTop: 10 },
  infoLabel: { fontSize: 12, color: C.textSecondary },
  infoValue: { fontSize: 12, color: C.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
