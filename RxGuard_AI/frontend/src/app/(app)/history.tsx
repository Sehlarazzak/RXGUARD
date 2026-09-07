import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Alert, Button, Card, C, EmptyState, LoadingPanel, PageHeader, PageShell, SectionTitle } from '@/components/ui';

interface HistoryItem {
  search_id: string;
  query: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ history: HistoryItem[] }>('/history/search');
      setHistory(res.history);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearAll = async () => {
    try {
      await api.del('/history/search');
      setHistory([]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const searchAgain = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}` as any);
  };

  if (error) {
    return <PageShell><PageHeader eyebrow="Your activity" title="Search history" subtitle="Review and reopen past medicine searches." /><Alert tone="error" title="History unavailable" message={error} action={<Button title="Try again" size="sm" variant="secondary" onPress={load} />} /></PageShell>;
  }
  if (!history) {
    return <PageShell><LoadingPanel label="Loading your search history…" /></PageShell>;
  }

  return (
    <PageShell>
      <PageHeader eyebrow="Your activity" title="Search history" subtitle="Review past registry searches and run one again with a single tap." actions={history.length > 0 ? <Button title="Clear history" variant="secondary" onPress={clearAll} /> : undefined} />

      <Card style={styles.historyCard}>
        <SectionTitle subtitle="Recent searches are stored under your account.">{history.length} search{history.length === 1 ? '' : 'es'}</SectionTitle>
        <View style={{ gap: 8, marginTop: 12 }}>
          {history.length === 0 ? (
            <EmptyState title="No searches yet." subtitle="Your searches will appear here after you use the search bar." />
          ) : (
            history.map((h) => (
              <Pressable key={h.search_id} accessibilityRole="button" accessibilityLabel={`Search again for ${h.query}`} style={({ pressed }) => [styles.historyItem, pressed && styles.pressed]} onPress={() => searchAgain(h.query)}>
                <View style={styles.historyIcon}><Text style={styles.historyIconText}>⌕</Text></View>
                <View style={{ flex: 1, gap: 2 }}><Text style={styles.queryText} numberOfLines={1}>{h.query}</Text><Text style={styles.dateText}>{new Date(h.created_at).toLocaleString()}</Text></View>
                <Text style={styles.searchAgainText}>Search again →</Text>
              </Pressable>
            ))
          )}
        </View>
      </Card>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  historyCard: { paddingBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 13, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border },
  historyIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  historyIconText: { color: C.primaryDark, fontSize: 16, fontWeight: '900' },
  queryText: { fontSize: 14, fontWeight: '900', color: C.text },
  dateText: { fontSize: 11.5, color: C.textSecondary },
  searchAgainText: { color: C.primaryDark, fontWeight: '800', fontSize: 11.5 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
