import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Badge, Card, C, EmptyState, Spinner } from '@/components/ui';

export default function MedicineDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  useEffect(() => {
    if (!id) return;
    api.get(`/medicines/${id}`)
      .then((r: any) => setProduct(r.product))
      .catch((e: any) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <EmptyState title="Medicine not found" subtitle={error} />
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </Card>
        </ScrollView>
      </View>
    );
  }
  if (!product) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.aliceBlue }}><Spinner label="Loading medicine..." /></View>;
  }

  const isSafe = product.is_safe;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Card>
        <View style={[styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.brand}>{product.brand_name}</Text>
            <Text style={styles.sub}>
              {product.dosage_form || 'Unknown form'}
              {product.registration_number ? ` · Registration #${product.registration_number}` : ' · Unregistered'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Badge status={product.safety_status} />
              <Text style={isSafe ? styles.safeText : styles.unsafeText}>
                {isSafe ? 'Safe to use as prescribed' : 'Not safe — see alerts below'}
              </Text>
            </View>
          </View>
          <View style={[styles.infoBox, isMobile && { width: '100%' }]}>
            <InfoRow label="Manufacturer" value={product.manufacturer_name || 'Unknown'} />
            <InfoRow label="Manufacturer ID" value={product.manufacturer_id ? String(product.manufacturer_id).slice(0, 8) + '…' : '—'} />
            <InfoRow label="Country" value={product.manufacturer_country || '—'} />
            <InfoRow label="Registration Date" value={product.registration_date ? new Date(product.registration_date).toLocaleDateString() : '—'} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {product.ingredients.length === 0 ? (
          <Text style={styles.muted}>No ingredient data available.</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {product.ingredients.map((ing: any, i: number) => (
              <View key={i} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientStrength}>
                  {ing.strength_value ? `${ing.strength_value} ${ing.strength_unit || ''}` : ing.composition_text || '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {product.batches && product.batches.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Batch Details</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            {product.batches.map((b: any) => (
              <View key={b.batch_id} style={styles.batchBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={styles.batchNumber}>Batch #{b.batch_number}</Text>
                  {b.classification ? <Badge status={b.classification.toLowerCase().includes('unregistered') ? 'unregistered' : 'substandard'} small /> : null}
                </View>
                <Text style={styles.batchMeta}>
                  Mfg: {b.manufacturing_date ? new Date(b.manufacturing_date).toLocaleDateString() : '—'} ·
                  Exp: {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '—'}
                </Text>
                {b.remarks ? <Text style={styles.batchRemarks}>{b.remarks}</Text> : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {product.notices && product.notices.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Safety Alerts</Text>
          <View style={{ gap: 12, marginTop: 10 }}>
            {product.notices.map((n: any) => (
              <View key={n.notice_id} style={styles.noticeBox}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge status={n.severity || 'unknown'} small />
                  <Text style={styles.noticeId}>{n.notice_identifier}</Text>
                  <Text style={styles.noticeDate}>{n.action_date ? new Date(n.action_date).toLocaleDateString() : ''}</Text>
                </View>
                <Text style={styles.noticeTitle}>{n.title}</Text>
                {n.problem_statement ? <Text style={styles.noticeBody}><Text style={{ fontWeight: '700' }}>Problem: </Text>{n.problem_statement}</Text> : null}
                {n.risk_statement ? <Text style={styles.noticeBody}><Text style={{ fontWeight: '700' }}>Risk: </Text>{n.risk_statement}</Text> : null}
                {n.action_initiated ? <Text style={styles.noticeBody}><Text style={{ fontWeight: '700' }}>Action: </Text>{n.action_initiated}</Text> : null}
                {n.source_name ? (
                  <Text style={styles.noticeSource}>Source: {n.source_name}{n.canonical_url ? ` — ${n.canonical_url}` : ''}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {!isSafe && user?.role !== 'patient' && product.alternatives && product.alternatives.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Safe Alternatives</Text>
          <Text style={styles.muted}>AI-ranked by ingredient similarity to {product.brand_name}</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {product.alternatives.map((alt: any) => (
              <Pressable
                key={alt.product_id}
                style={styles.altBox}
                onPress={() => router.push(`/medicine/${alt.product_id}` as any)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <Text style={styles.altName}>{alt.brand_name}</Text>
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreText}>{alt.similarity_score}% match</Text>
                  </View>
                </View>
                <Text style={styles.altGeneric}>Generic: {alt.generic_name}</Text>
                {alt.similar_ingredients.length > 0 ? (
                  <Text style={styles.altShared}>Shared ingredients: {alt.similar_ingredients.join(', ')}</Text>
                ) : null}
                <Text style={styles.altMeta}>
                  {alt.dosage_form || '—'} · {alt.manufacturer_name || 'Unknown'}
                  {alt.registration_number ? ` · Reg #${alt.registration_number}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {product.sources && product.sources.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Sources</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {product.sources.map((s: any, i: number) => (
              <View key={i} style={styles.sourceRow}>
                <Text style={styles.sourceName}>{s.source_name}</Text>
                <Text style={styles.sourceMeta}>
                  {s.title || s.canonical_url} {s.is_official ? '· Official' : ''}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue },
  content: { padding: 20, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' as const, paddingBottom: 60 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  headerRow: { flexDirection: 'row', gap: 20 },
  brand: { fontSize: 24, fontWeight: '800', color: C.text },
  sub: { fontSize: 14, color: C.textSecondary },
  safeText: { color: C.green, fontWeight: '600', fontSize: 13 },
  unsafeText: { color: C.red, fontWeight: '600', fontSize: 13 },
  infoBox: { width: 280, backgroundColor: C.gray50, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: C.border },
  infoLabel: { fontSize: 12.5, color: C.textSecondary },
  infoValue: { fontSize: 12.5, color: C.text, fontWeight: '600', flexShrink: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  muted: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
  },
  ingredientName: { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  ingredientStrength: { fontSize: 13, color: C.textSecondary },
  batchBox: { padding: 12, borderRadius: 12, backgroundColor: C.redBg, borderWidth: 1, borderColor: '#FECACA', gap: 4 },
  batchNumber: { fontSize: 14.5, fontWeight: '800', color: C.red },
  batchMeta: { fontSize: 12.5, color: C.textSecondary },
  batchRemarks: { fontSize: 12.5, color: C.text },
  noticeBox: { padding: 14, borderRadius: 12, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, gap: 6 },
  noticeId: { fontSize: 12.5, fontWeight: '700', color: C.primary },
  noticeDate: { fontSize: 12, color: C.textSecondary },
  noticeTitle: { fontSize: 14.5, fontWeight: '700', color: C.text },
  noticeBody: { fontSize: 13, color: C.text, lineHeight: 19 },
  noticeSource: { fontSize: 12, color: C.textSecondary, fontStyle: 'italic' },
  altBox: { padding: 14, borderRadius: 12, backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#BBF7D0', gap: 5 },
  altName: { fontSize: 15.5, fontWeight: '800', color: C.text, flex: 1 },
  scoreChip: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { color: C.white, fontWeight: '800', fontSize: 12 },
  altGeneric: { fontSize: 13, color: C.text },
  altShared: { fontSize: 12.5, color: C.green, fontWeight: '600' },
  altMeta: { fontSize: 12, color: C.textSecondary },
  sourceRow: { padding: 12, borderRadius: 10, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, gap: 2 },
  sourceName: { fontSize: 13.5, fontWeight: '700', color: C.text },
  sourceMeta: { fontSize: 12, color: C.textSecondary },
});
