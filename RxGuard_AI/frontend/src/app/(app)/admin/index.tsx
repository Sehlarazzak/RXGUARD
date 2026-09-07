import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, C, EmptyState, PageHeader, Spinner } from '@/components/ui';

interface MedicineRow {
  product_id: string;
  brand_name: string;
  dosage_form: string | null;
  registration_number: string | null;
  registration_date: string | null;
  safety_status: string;
  source_category: string | null;
  source_text: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  ingredient_count: number;
  batch_count: number;
  notice_count: number;
  completeness: { missing: string[]; complete: boolean; score: number };
}

interface FilterOptions {
  statuses: string[];
  forms: string[];
  manufacturers: { id: string; v: string }[];
  sources: string[];
}

const PAGE_SIZE = 25;

export default function AdminMedicinesPage() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 1100;
  const resultsMaxHeight = Math.max(320, (height || 800) - 260);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('name');

  const [rows, setRows] = useState<MedicineRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  // Debounce the central search box (live-filtering only — history is
  // recorded when the admin actually selects a result, not per keystroke
  // fragment, so "br" never pollutes the search history)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api
      .get<FilterOptions>('/admin/medicines/filters')
      .then(setFilters)
      .catch((e: any) => setError(e.message));
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set('search', debounced);
    if (status) p.set('status', status);
    if (form) p.set('form', form);
    if (manufacturer) p.set('manufacturer', manufacturer);
    if (source) p.set('source', source);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('sort', sort);
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String(offset));
    return p.toString();
  }, [debounced, status, form, manufacturer, source, from, to, sort, offset]);

  const loadRows = useCallback(async () => {
    setRows(null);
    try {
      const res = await api.get<{ medicines: MedicineRow[]; total: number }>(`/admin/medicines?${query}`);
      setRows(res.medicines);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    }
  }, [query]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get<{ product: any }>(`/admin/medicines/${id}`);
      setDetail(res.product);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selectRow = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    } else {
      loadDetail(id);
    }
  };

  const clearFilters = () => {
    setStatus('');
    setForm('');
    setManufacturer('');
    setSource('');
    setFrom('');
    setTo('');
    setOffset(0);
  };

  const activeFilterCount =
    (status ? 1 : 0) + (form ? 1 : 0) + (manufacturer ? 1 : 0) + (source ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  const hasPrev = offset > 0;
  const hasNext = rows !== null && offset + PAGE_SIZE < total;

  return (
    <View style={styles.page}>
      <PageHeader
        eyebrow="Administration"
        title="Medicine registry"
        subtitle="Search active records by product, ingredient, registration number, manufacturer, DRAP alert number, or batch number."
      />

      <View style={styles.searchBar}> 
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          accessibilityLabel="Search medicine registry"
          value={search}
          onChangeText={(t) => {
            setSearch(t);
          }}
          placeholder="Search the registry…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Text style={styles.clearX}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Alert tone="error" title="Registry data could not be loaded" message={error} action={<Button title="Retry" size="sm" variant="secondary" onPress={loadRows} />} /> : null}

      <View style={[styles.body, isWide && styles.bodyWide]}>
        {/* LEFT: filter panel */}
        <View style={isWide ? styles.filterPanel : styles.filterPanelNarrow}>
          <Card elevated>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showFilters }}
              style={styles.filterHeader}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={styles.filterTitle}>Filters {activeFilterCount ? `(${activeFilterCount})` : ''}</Text>
              <Text style={styles.chevron}>{showFilters ? '▾' : '▸'}</Text>
            </Pressable>
            {showFilters ? (
              <View style={{ gap: 12, marginTop: 10 }}>
                <Select
                  label="Safety status"
                  value={status}
                  options={(filters?.statuses || []).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                  onChange={(v) => {
                    setStatus(v);
                    setOffset(0);
                  }}
                />
                <Select
                  label="Dosage form"
                  value={form}
                  options={(filters?.forms || []).map((s) => ({ value: s, label: s }))}
                  onChange={(v) => {
                    setForm(v);
                    setOffset(0);
                  }}
                />
                <Select
                  label="Manufacturer"
                  value={manufacturer}
                  options={(filters?.manufacturers || []).map((m) => ({ value: m.id, label: m.v }))}
                  onChange={(v) => {
                    setManufacturer(v);
                    setOffset(0);
                  }}
                />
                <Select
                  label="Source type"
                  value={source}
                  options={(filters?.sources || []).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                  onChange={(v) => {
                    setSource(v);
                    setOffset(0);
                  }}
                />
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>Registration date range</Text>
                  <TextInput
                    value={from}
                    onChangeText={(t) => {
                      setFrom(t);
                      setOffset(0);
                    }}
                    placeholder="From (YYYY-MM-DD)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.dateInput}
                  />
                  <TextInput
                    value={to}
                    onChangeText={(t) => {
                      setTo(t);
                      setOffset(0);
                    }}
                    placeholder="To (YYYY-MM-DD)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.dateInput}
                  />
                </View>
                <Select
                  label="Sort by"
                  value={sort}
                  options={[
                    { value: 'name', label: 'Name' },
                    { value: 'status', label: 'Safety status' },
                    { value: 'manufacturer', label: 'Manufacturer' },
                    { value: 'date', label: 'Registration date' },
                  ]}
                  onChange={setSort}
                  allowClear={false}
                />
                <Pressable style={styles.clearBtn} onPress={clearFilters}>
                  <Text style={styles.clearBtnText}>Clear all filters</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        </View>

        {/* CENTER: results */}
        <View style={styles.results}>
          <Card style={{ flex: 1, gap: 10 }} elevated>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {rows === null ? 'Loading...' : `${total} medicine${total === 1 ? '' : 's'}`}
              </Text>
              {hasPrev || hasNext ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Pressable disabled={!hasPrev} style={[styles.pageBtn, !hasPrev && { opacity: 0.4 }]} onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                    <Text style={styles.pageBtnText}>← Prev</Text>
                  </Pressable>
                  <Text style={styles.pageInfo}>
                    {Math.floor(offset / PAGE_SIZE) + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  </Text>
                  <Pressable disabled={!hasNext} style={[styles.pageBtn, !hasNext && { opacity: 0.4 }]} onPress={() => setOffset(offset + PAGE_SIZE)}>
                    <Text style={styles.pageBtnText}>Next →</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <ScrollView style={{ flex: 1, maxHeight: resultsMaxHeight }} contentContainerStyle={{ gap: 8, flexGrow: 1 }}>
              {rows === null ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator color={C.primary} />
                </View>
              ) : rows.length === 0 ? (
                <EmptyState title="No medicines match your search or filters." subtitle="Try a different term or clear the filters." />
              ) : (
                rows.map((r) => (
                  <Pressable
                    key={r.product_id}
                    onPress={() => {
                      // Selecting a result of an active search completes the
                      // lookup — record the medicine name in search history.
                      if (debounced.trim()) {
                        api.post('/history/search', { query: r.brand_name }).catch(() => undefined);
                      }
                      selectRow(r.product_id);
                    }}
                    style={[styles.row, selectedId === r.product_id && styles.rowActive]}
                  >
                    <View style={{ flex: 2, gap: 3, minWidth: 140 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{r.brand_name}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {r.dosage_form || '—'} · {r.manufacturer_name || 'Unknown manufacturer'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 90 }}>
                      <Badge status={r.safety_status} small />
                    </View>
                    <View style={{ flex: 1, minWidth: 80 }}>
                      <Text style={styles.rowReg} numberOfLines={1}>{r.registration_number || 'no reg. no.'}</Text>
                    </View>
                    <View style={{ width: 110, gap: 4 }}>
                      <Text style={styles.completenessLabel}>{r.completeness.score}% complete</Text>
                      <View style={styles.completenessTrack}>
                        <View
                          style={{
                            width: `${r.completeness.score}%`,
                            height: '100%',
                            borderRadius: 4,
                            backgroundColor:
                              r.completeness.score === 100 ? C.green : r.completeness.score >= 60 ? C.amber : C.red,
                          }}
                        />
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Card>
        </View>

        {/* RIGHT: record detail */}
        {selectedId ? (
          <View style={isWide ? styles.detailPanel : null}>
            <RecordPanel
              productId={selectedId}
              detail={detail}
              loading={detailLoading}
              onClose={() => {
                setSelectedId(null);
                setDetail(null);
              }}
              onEdit={() => setEditOpen(true)}
              onSaved={() => {
                loadDetail(selectedId);
                loadRows();
              }}
            />
          </View>
        ) : null}
      </View>

      {/* Edit modal */}
      {editOpen && detail ? (
        <EditModal
          product={detail}
          filters={filters}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            if (selectedId) {
              loadDetail(selectedId);
              loadRows();
            }
          }}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Record detail panel: completeness, node map, linked records, timeline
// ---------------------------------------------------------------------------
function RecordPanel({
  productId,
  detail,
  loading,
  onClose,
  onEdit,
  onSaved,
}: {
  productId: string;
  detail: any;
  loading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSaved: () => void;
}) {
  if (loading || !detail) {
    return (
      <Card style={styles.detailCard} elevated>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Record</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
        </View>
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      </Card>
    );
  }

  const missing: string[] = detail.completeness?.missing || [];

  return (
    <Card style={styles.detailCard} elevated>
      <View style={styles.detailHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.detailTitle} numberOfLines={2}>{detail.brand_name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Badge status={detail.safety_status} small />
            <Text style={styles.detailMeta}>{detail.dosage_form || '—'}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>

      {/* Data completeness indicator */}
      <View style={styles.completenessBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.boxLabel}>Data completeness</Text>
          <Text style={{ fontWeight: '800', color: detail.completeness.score === 100 ? C.green : C.amber }}>
            {detail.completeness.score}%
          </Text>
        </View>
        <View style={[styles.completenessTrack, { marginTop: 6 }]}>
          <View
            style={{
              width: `${detail.completeness.score}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: detail.completeness.score === 100 ? C.green : detail.completeness.score >= 60 ? C.amber : C.red,
            }}
          />
        </View>
        {missing.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {missing.map((m) => (
              <View key={m} style={styles.missingChip}>
                <Text style={styles.missingChipText}>missing: {m.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: C.green, fontSize: 12, marginTop: 6, fontWeight: '600' }}>
            All required fields are present.
          </Text>
        )}
      </View>

      <Button title="Edit record" onPress={onEdit} />

      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {/* Relationship node map */}
        <View>
          <Text style={styles.boxLabel}>Relationship map</Text>
          <NodeMap product={detail} />
        </View>

        {/* Ingredients */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Ingredients</Text>
          {detail.ingredients?.length ? (
            detail.ingredients.map((i: any) => (
              <Text key={i.ingredient_id} style={styles.infoRow}>
                • {i.name}
                {i.strength_value ? ` — ${i.strength_value}${i.strength_unit || ''}` : ''}
                {i.composition_text ? ` (${i.composition_text})` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.infoEmpty}>No ingredients recorded.</Text>
          )}
        </View>

        {/* Manufacturer */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Manufacturer</Text>
          <Text style={styles.infoRow}>{detail.manufacturer_name || 'Unknown'}</Text>
          {detail.manufacturer_country ? <Text style={styles.infoSub}>{detail.manufacturer_country}</Text> : null}
          {detail.manufacturer_address ? <Text style={styles.infoSub}>{detail.manufacturer_address}</Text> : null}
        </View>

        {/* DRAP safety notices */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>DRAP safety notices</Text>
          {detail.notices?.length ? (
            <View style={{ gap: 10 }}>
              {detail.notices.map((n: any) => (
                <View key={n.notice_id} style={styles.noticeBox}>
                  <Text style={styles.noticeTitle} numberOfLines={2}>{n.title}</Text>
                  <Text style={styles.noticeMeta}>
                    {n.notice_identifier} · {n.notice_type || 'notice'}
                    {n.action_date ? ` · ${new Date(n.action_date).toLocaleDateString()}` : ''}
                  </Text>
                  {n.problem_statement ? <Text style={styles.noticeBody}>Problem: {n.problem_statement}</Text> : null}
                  {n.risk_statement ? <Text style={styles.noticeBody}>Risk: {n.risk_statement}</Text> : null}
                  {n.source_name ? (
                    <Text style={styles.noticeSource}>Source: {n.source_name}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoEmpty}>No safety notices linked.</Text>
          )}
        </View>

        {/* Recall batches */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Batches</Text>
          {detail.batches?.length ? (
            detail.batches.map((b: any) => (
              <Text key={b.batch_id || b.batch_number} style={styles.infoRow}>
                • #{b.batch_number}
                {b.manufacturing_date ? ` (mfg ${new Date(b.manufacturing_date).toLocaleDateString()}` : ''}
                {b.expiry_date ? `, exp ${new Date(b.expiry_date).toLocaleDateString()})` : b.manufacturing_date ? ')' : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.infoEmpty}>No batch data.</Text>
          )}
        </View>

        {/* Sources */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>DRAP sources</Text>
          {detail.sources?.length ? (
            detail.sources.map((s: any) => (
              <Pressable
                key={s.document_id}
                onPress={() => s.canonical_url && typeof window !== 'undefined' && window.open(s.canonical_url, '_blank')}
              >
                <Text style={[styles.infoRow, s.canonical_url && { color: C.primary, textDecorationLine: 'underline' }]}>
                  • {s.title || s.source_name}
                </Text>
                {s.publication_date ? (
                  <Text style={styles.infoSub}>Published {new Date(s.publication_date).toLocaleDateString()}</Text>
                ) : null}
              </Pressable>
            ))
          ) : detail.source_text ? (
            <Text style={styles.infoRow}>{detail.source_text}</Text>
          ) : (
            <Text style={styles.infoEmpty}>No source documents.</Text>
          )}
        </View>

        {/* Alternatives */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Safe alternatives</Text>
          {detail.ai_alternatives?.length ? (
            <View style={{ gap: 8 }}>
              {detail.ai_alternatives.map((a: any) => (
                <View key={a.product_id} style={styles.altRow}>
                  <Text style={styles.altName}>{a.brand_name}</Text>
                  <Text style={styles.altScore}>{a.similarity_score}% match</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoEmpty}>No safe alternatives found.</Text>
          )}
        </View>

        {/* Timeline */}
        <View>
          <Text style={styles.boxLabel}>DRAP & administrative timeline</Text>
          <View style={{ marginTop: 10, gap: 0 }}>
            {detail.timeline?.length ? (
              detail.timeline.map((t: any, i: number) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: timelineColor(t.type) }]} />
                    {i < detail.timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <Text style={styles.timelineDate}>
                      {t.date ? new Date(t.date).toLocaleDateString() : '—'}
                    </Text>
                    <Text style={styles.timelineLabel}>{t.label}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.infoEmpty}>No timeline events.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </Card>
  );
}

function timelineColor(type: string): string {
  switch (type) {
    case 'registration': return C.primary;
    case 'source': return '#059669';
    case 'recall': return C.red;
    case 'batch': return C.amber;
    case 'status': return '#7C3AED';
    default: return C.textSecondary;
  }
}

// ---------------------------------------------------------------------------
// Visual node map: central product with linked entity nodes
// ---------------------------------------------------------------------------
function NodeMap({ product }: { product: any }) {
  const nodes = [
    { label: 'Manufacturer', value: product.manufacturer_name || 'Unknown', color: '#4A7BD8' },
    { label: 'Ingredients', value: `${product.ingredients?.length || 0} linked`, color: '#7C3AED' },
    { label: 'MA Holder', value: product.holder_name || '—', color: '#0891B2' },
    { label: 'Safety Notices', value: String(product.notices?.length || 0), color: C.red },
    { label: 'Recall Batches', value: String(product.batches?.length || 0), color: C.amber },
    { label: 'DRAP Sources', value: String(product.sources?.length || 0), color: '#059669' },
    { label: 'Alternatives', value: String((product.stored_alternatives?.length || 0) + (product.ai_alternatives?.length || 0)), color: '#2563EB' },
    { label: 'Identifiers', value: String(product.identifiers?.length || 0), color: '#6B7280' },
  ];
  return (
    <View style={{ alignItems: 'center', marginTop: 10 }}>
      <View style={mapStyles.center}>
        <Text numberOfLines={1} style={mapStyles.centerTitle}>{product.brand_name}</Text>
        <Text style={mapStyles.centerSub}>{product.dosage_form || '—'}</Text>
      </View>
      <View style={[mapStyles.stub, { backgroundColor: C.primary, height: 16 }]} />
      <View style={mapStyles.bus} />
      <View style={mapStyles.nodeWrap}>
        {nodes.map((n) => (
          <View key={n.label} style={mapStyles.nodeCol}>
            <View style={[mapStyles.stub, { backgroundColor: n.color }]} />
            <View style={[mapStyles.node, { borderColor: n.color }]}>
              <Text style={[mapStyles.nodeLabel, { color: n.color }]}>{n.label}</Text>
              <Text numberOfLines={1} style={mapStyles.nodeValue}>{n.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  center: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    alignItems: 'center',
    maxWidth: 260,
  },
  centerTitle: { color: C.white, fontWeight: '800', fontSize: 14.5 },
  centerSub: { color: '#DBEAFE', fontSize: 11, marginTop: 2 },
  stub: { width: 2, height: 12 },
  bus: { width: '96%', height: 2, backgroundColor: '#C7D2E8' },
  nodeWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  nodeCol: { width: '50%', alignItems: 'center', paddingHorizontal: 4 },
  node: {
    borderWidth: 1.5,
    borderRadius: 10,
    backgroundColor: C.white,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    width: '100%',
    minHeight: 52,
    justifyContent: 'center',
  },
  nodeLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  nodeValue: { fontSize: 11.5, color: C.text, marginTop: 2, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Select dropdown (modal-based, works on web + native)
// ---------------------------------------------------------------------------
function Select({
  label,
  value,
  options,
  onChange,
  allowClear = true,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable style={styles.selectBox} onPress={() => setOpen(true)}>
        <Text style={current ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {current ? current.label : 'Any'}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.selectOverlay} onPress={() => setOpen(false)}>
          <View style={styles.selectSheet}>
            <Text style={styles.selectSheetTitle}>{label || 'Select'}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {allowClear ? (
                <Pressable
                  style={styles.selectOption}
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.selectOptionText, { color: C.textSecondary }]}>— Any / clear —</Text>
                </Pressable>
              ) : null}
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  style={[styles.selectOption, o.value === value && { backgroundColor: C.aliceBlue }]}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.selectOptionText}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Edit modal: attribute editing + safety classification change with reason
// ---------------------------------------------------------------------------
function EditModal({
  product,
  filters,
  onClose,
  onSaved,
}: {
  product: any;
  filters: FilterOptions | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [brandName, setBrandName] = useState(product.brand_name || '');
  const [dosageForm, setDosageForm] = useState(product.dosage_form || '');
  const [regNumber, setRegNumber] = useState(product.registration_number || '');
  const [manufacturerId, setManufacturerId] = useState(product.manufacturer_id || '');
  const [sourceText, setSourceText] = useState(product.source_text || '');
  const [safetyStatus, setSafetyStatus] = useState(String(product.safety_status || ''));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusChanged = safetyStatus !== String(product.safety_status);

  const save = async () => {
    setError(null);
    if (statusChanged && !reason.trim()) {
      setError('A reason is required when changing the safety classification.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (brandName.trim() && brandName !== product.brand_name) body.brand_name = brandName.trim();
      if (dosageForm && dosageForm !== product.dosage_form) body.dosage_form = dosageForm;
      if (regNumber.trim() && regNumber !== product.registration_number) body.registration_number = regNumber.trim();
      if (manufacturerId && manufacturerId !== product.manufacturer_id) body.manufacturer_id = manufacturerId;
      if (sourceText.trim() && sourceText !== product.source_text) body.source_text = sourceText.trim();
      if (statusChanged) {
        body.safety_status = safetyStatus;
        body.reason = reason.trim();
      }
      if (Object.keys(body).length === 0) {
        setError('No changes to save.');
        setSaving(false);
        return;
      }
      await api.patch(`/admin/medicines/${product.product_id}`, body);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.selectOverlay} onPress={onClose}>
        <Pressable style={styles.editSheet} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.editTitle}>Edit medicine record</Text>
          <Text style={styles.editSub}>{product.brand_name}</Text>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Brand name</Text>
              <TextInput value={brandName} onChangeText={setBrandName} style={styles.dateInput} />
            </View>
            <Select
              label="Dosage form"
              value={dosageForm}
              options={(filters?.forms || []).map((f) => ({ value: f, label: f }))}
              onChange={setDosageForm}
            />
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Registration number</Text>
              <TextInput value={regNumber} onChangeText={setRegNumber} style={styles.dateInput} />
            </View>
            <Select
              label="Manufacturer"
              value={manufacturerId}
              options={(filters?.manufacturers || []).map((m) => ({ value: m.id, label: m.v }))}
              onChange={setManufacturerId}
            />
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Source text</Text>
              <TextInput value={sourceText} onChangeText={setSourceText} style={styles.dateInput} />
            </View>
            <Select
              label="Safety classification"
              value={safetyStatus}
              options={(filters?.statuses || []).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              onChange={(v) => setSafetyStatus(v || String(product.safety_status))}
              allowClear={false}
            />
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>
                Reason for safety change {statusChanged ? '(required)' : '(only needed if you change the status)'}
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder="e.g. DRAP recall notice 2025-DRAP-043 verified..."
                placeholderTextColor="#9CA3AF"
                style={[styles.dateInput, { height: 84, textAlignVertical: 'top' }]}
              />
            </View>
            {error ? <Alert tone="error" title="Could not save record" message={error} /> : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <Button title="Save changes" loading={saving} onPress={save} />
            <Button title="Cancel" variant="secondary" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue, padding: 24, gap: 18, maxWidth: 1500, width: '100%', alignSelf: 'center' as const },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15.5, paddingVertical: 12, color: C.text },
  clearX: { fontSize: 14, color: C.textSecondary, paddingHorizontal: 6 },
  body: { flexDirection: 'column', gap: 14, flex: 1 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  filterPanel: { width: 250, flexShrink: 0 },
  filterPanelNarrow: { width: '100%' },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  chevron: { color: C.textSecondary, fontSize: 13 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: C.text },
  dateInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: C.white,
    color: C.text,
  },
  clearBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: C.white,
  },
  clearBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  results: { flex: 1, minWidth: 0 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  resultsTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  pageBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: C.aliceBlue },
  pageBtnText: { color: C.primary, fontWeight: '700', fontSize: 12.5 },
  pageInfo: { fontSize: 12.5, color: C.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: C.gray50,
  },
  rowActive: { borderColor: C.primary, backgroundColor: C.aliceBlue },
  rowName: { fontSize: 14.5, fontWeight: '700', color: C.text },
  rowMeta: { fontSize: 12, color: C.textSecondary },
  rowReg: { fontSize: 12.5, color: C.textSecondary },
  completenessLabel: { fontSize: 10.5, color: C.textSecondary, fontWeight: '600' },
  completenessTrack: { height: 6, borderRadius: 4, backgroundColor: C.gray100, overflow: 'hidden' as const },
  detailPanel: { width: 430, flexShrink: 0 },
  detailCard: { gap: 12 },
  detailHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  detailTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  detailMeta: { fontSize: 12.5, color: C.textSecondary },
  closeX: { fontSize: 16, color: C.textSecondary, paddingHorizontal: 6 },
  completenessBox: {
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
  },
  boxLabel: { fontSize: 12.5, fontWeight: '800', color: C.text, textTransform: 'capitalize' },
  missingChip: { backgroundColor: C.redBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  missingChipText: { color: C.red, fontSize: 10.5, fontWeight: '700' },
  infoBox: { gap: 6 },
  infoRow: { fontSize: 13.5, color: C.text, lineHeight: 20 },
  infoSub: { fontSize: 12, color: C.textSecondary },
  infoEmpty: { fontSize: 13, color: C.textSecondary, fontStyle: 'italic' },
  noticeBox: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: C.redBg,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: C.red },
  noticeMeta: { fontSize: 11.5, color: C.textSecondary },
  noticeBody: { fontSize: 12.5, color: C.text, lineHeight: 18 },
  noticeSource: { fontSize: 11.5, color: C.primary, fontWeight: '600' },
  altRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: C.greenBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  altName: { fontSize: 13, fontWeight: '700', color: C.text, flexShrink: 1 },
  altScore: { fontSize: 11.5, color: C.green, fontWeight: '800' },
  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: C.gray100, marginTop: 2 },
  timelineDate: { fontSize: 11.5, fontWeight: '800', color: C.textSecondary },
  timelineLabel: { fontSize: 13, color: C.text, lineHeight: 19, marginTop: 1 },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.white,
  },
  selectValue: { fontSize: 13.5, color: C.text, flexShrink: 1 },
  selectPlaceholder: { fontSize: 13.5, color: C.textSecondary },
  selectChevron: { color: C.textSecondary, marginLeft: 8 },
  selectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectSheet: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    gap: 10,
  },
  selectSheetTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  selectOption: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  selectOptionText: { fontSize: 14, color: C.text },
  editSheet: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
  },
  editTitle: { fontSize: 19, fontWeight: '800', color: C.text },
  editSub: { fontSize: 13, color: C.textSecondary, marginBottom: 10 },
});
