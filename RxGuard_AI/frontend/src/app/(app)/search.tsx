import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Badge, Card, C, EmptyState, PageShell, SectionTitle, Spinner } from '@/components/ui';

interface Suggestion {
  product_id: string;
  brand_name: string;
  dosage_form: string | null;
  safety_status: string;
  manufacturer_name: string | null;
}

interface SearchResult {
  product_id: string;
  brand_name: string;
  dosage_form: string | null;
  registration_number: string | null;
  safety_status: string;
  manufacturer_name: string | null;
}

interface SmartResult extends SearchResult {
  keyword_rank: number | null;
  semantic_rank: number | null;
  semantic_score: number | null;
  rrf_score: number;
  match_source: 'keyword' | 'semantic' | 'hybrid';
}

interface SmartSearchResponse {
  results: SmartResult[];
  query: string;
  semantic_available: boolean;
  message: string;
}

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smart, setSmart] = useState(false);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860;
  const resultsMaxHeight = Math.max(280, Math.min(560, (height || 800) - 360));
  const debounceRef = useRef<any>(null);

  // Live suggestions dropdown as the user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await api.get<{ suggestions: Suggestion[] }>(`/medicines/suggest?q=${encodeURIComponent(term.trim())}`);
        setSuggestions(res.suggestions);
        setShowSuggest(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term]);

  const runSearch = useCallback(async (q?: string) => {
    const query = (q ?? term).trim();
    setShowSuggest(false);
    setSmartMessage(null);
    if (!query) {
      setError('Please type something to search.');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      if (smart) {
        const res = await api.get<SmartSearchResponse>(`/medicines/search/smart?q=${encodeURIComponent(query)}`);
        setResults(res.results);
        setSmartMessage(res.message || null);
      } else {
        const res = await api.get<{ results: SearchResult[] }>(`/medicines/search?q=${encodeURIComponent(query)}`);
        setResults(res.results);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }, [term, smart]);

  // A search arriving from the history page ("Search again") carries ?q= — run
  // it once on mount so the user sees the results immediately.
  useEffect(() => {
    if (params.q) {
      const q = String(params.q);
      setTerm(q);
      runSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  // Clicking a suggestion is a search too — log it before navigating so it
  // appears in the search history like every other executed search.
  const logSearch = (query: string) => {
    api.post('/history/search', { query }).catch(() => undefined);
  };

  // Select a medicine from the live dropdown: record the medicine NAME
  // (never the typed fragment) and open its detail page.
  const selectSuggestion = (s: Suggestion) => {
    setTerm(s.brand_name);
    setShowSuggest(false);
    logSearch(s.brand_name);
    router.push(`/medicine/${s.product_id}` as any);
  };

  return (
    <PageShell>
      <Text style={styles.title}>Search Medicines</Text>
      <Text style={styles.subtitle}>
        Search by medicine name, ingredient, registration number, manufacturer, DRAP alert or batch number.
      </Text>

      <View style={{ position: 'relative', zIndex: 100 }}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              value={term}
              onChangeText={(t) => {
                setTerm(t);
                setResults(null);
              }}
              placeholder="Search medicines, ingredients, batches..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              onSubmitEditing={() => {
                // Autocomplete convention: Enter picks the first suggestion
                // while the dropdown is open; otherwise it runs a raw search.
                if (showSuggest && suggestions.length > 0) selectSuggestion(suggestions[0]);
                else runSearch();
              }}
              onFocus={() => setShowSuggest(true)}
            />
            {suggestLoading ? <ActivityIndicator color={C.primary} style={{ marginRight: 10 }} /> : null}
          </View>
          <Pressable style={styles.searchBtn} onPress={() => runSearch()}>
            <Text style={styles.searchBtnText}>{smart ? 'Smart Search' : 'Search'}</Text>
          </Pressable>
          <Pressable
            style={[styles.smartBtn, smart && styles.smartBtnActive]}
            onPress={() => setSmart((s) => !s)}
          >
            <Text style={[styles.smartBtnText, smart && styles.smartBtnTextActive]}>✨</Text>
          </Pressable>
        </View>

        <Text style={styles.smartHint}>
          {smart
            ? 'Smart search understands natural language like "medicine for fever and headache".'
            : 'Standard search matches medicine names, ingredients, batches and manufacturers.'}
        </Text>

        {showSuggest && suggestions.length > 0 ? (
          <View style={styles.suggestBox}>
            {suggestions.map((s) => (
              <Pressable
                key={s.product_id}
                style={styles.suggestItem}
                onPress={() => selectSuggestion(s)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.suggestName}>{s.brand_name}</Text>
                  <Text style={styles.suggestSub}>
                    {s.dosage_form || '—'} · {s.manufacturer_name || 'Unknown manufacturer'}
                  </Text>
                </View>
                <Badge status={s.safety_status} small />
              </Pressable>
            ))}
            <Pressable style={[styles.suggestItem, { justifyContent: 'center' }]} onPress={() => runSearch()}>
              <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13.5 }}>
                See all results for &quot;{term.trim()}&quot;
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}

      {searching ? (
        <Spinner label="Searching the RxGuard database..." />
      ) : results !== null ? (
        <Card>
          <SectionTitle>{results.length} result{results.length === 1 ? '' : 's'}</SectionTitle>
          <ScrollView style={{ marginTop: 12, maxHeight: resultsMaxHeight }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
            {results.length === 0 ? (
              <EmptyState
                title="No medicines found."
                subtitle={smartMessage || 'Try a different spelling, or search by ingredient (e.g. Paracetamol).'}
              />
            ) : (
              results.map((r) => (
                <Pressable
                  key={r.product_id}
                  style={styles.resultItem}
                  onPress={() => router.push(`/medicine/${r.product_id}` as any)}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.resultName}>{r.brand_name}</Text>
                    <Text style={styles.resultSub}>
                      {r.dosage_form || '—'} · {r.manufacturer_name || 'Unknown manufacturer'}
                      {r.registration_number ? ` · Reg #${r.registration_number}` : ''}
                    </Text>
                  </View>
                  <Badge status={r.safety_status} />
                  <Text style={{ color: C.primary, fontWeight: '700' }}>View →</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Card>
      ) : (
        user?.role === 'patient' ? <RetailersSection /> : null
      )}
    </PageShell>
  );
}

function RetailersSection() {
  const [retailers, setRetailers] = useState<any[]>([]);
  useEffect(() => {
    api.get('/medicines/retailers/nearby').then((r: any) => setRetailers(r.retailers)).catch(() => undefined);
  }, []);
  if (!retailers.length) return null;
  return (
    <Card>
      <SectionTitle>Nearby Medicine Retailers</SectionTitle>
      <View style={{ gap: 8, marginTop: 10 }}>
        {retailers.slice(0, 6).map((r) => (
          <View key={r.retailer_id} style={styles.retailerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.retailerName}>{r.name}</Text>
              <Text style={styles.retailerSub}>{r.address}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={styles.retailerHours}>{r.hours}</Text>
              <Text style={styles.retailerPhone}>{r.phone}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    shadowColor: C.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15.5, color: C.text },
  searchBtn: { backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 24, justifyContent: 'center' },
  searchBtnText: { color: C.white, fontWeight: '800', fontSize: 15 },
  smartBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  smartBtnActive: { backgroundColor: C.primary },
  smartBtnText: { fontSize: 18 },
  smartBtnTextActive: { color: C.white },
  smartHint: { fontSize: 12, color: C.textSecondary, marginTop: 8, marginLeft: 4 },
  suggestBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 90,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    zIndex: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.gray100,
    backgroundColor: C.white,
  },
  suggestName: { fontSize: 14.5, fontWeight: '700', color: C.text },
  suggestSub: { fontSize: 12, color: C.textSecondary },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
  },
  resultName: { fontSize: 15, fontWeight: '700', color: C.text },
  resultSub: { fontSize: 12, color: C.textSecondary },
  retailerRow: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  retailerName: { fontSize: 14, fontWeight: '700', color: C.text },
  retailerSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  retailerHours: { fontSize: 12, color: C.green, fontWeight: '600' },
  retailerPhone: { fontSize: 12, color: C.textSecondary },
});
