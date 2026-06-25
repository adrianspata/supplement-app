import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadii, Shadows } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

interface ProductProsConsCardProps {
  pros: string[];
  cons: string[];
}

export function ProductProsConsCard({ pros, cons }: ProductProsConsCardProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.background, borderColor: themeColors.borderMuted }]}>
      {pros.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>WHY WE LIKE IT</Text>
          {pros.map((pro, idx) => (
            <View key={`pro-${idx}`} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={18} color={themeColors.success} style={{ marginRight: 12, marginTop: 2 }} />
              <Text style={[styles.bulletText, { color: themeColors.text }]}>{pro}</Text>
            </View>
          ))}
        </View>
      )}

      {cons.length > 0 && (
        <View style={[styles.section, pros.length > 0 && { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: themeColors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>POTENTIAL DRAWBACKS</Text>
          {cons.map((con, idx) => (
            <View key={`con-${idx}`} style={styles.bulletRow}>
              <Ionicons name="alert-circle" size={18} color={themeColors.textMuted} style={{ marginRight: 12, marginTop: 2 }} />
              <Text style={[styles.bulletTextMuted, { color: themeColors.textSecondary }]}>{con}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadii.xl,
    padding: 24,
    borderWidth: 1,
    ...Shadows.low,
    marginBottom: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },
  bulletTextMuted: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },
});
