import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getNovaColor, getNutriScoreColor, borderRadius, typography } from '@/theme';

interface ScoreBadgeProps {
  type: 'nutri' | 'nova';
  value: string | number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  glow?: boolean;
}

const SIZE_MAP = {
  sm: { box: 24, font: 10, borderWidth: 1.5 },
  md: { box: 32, font: 12, borderWidth: 1.5 },
  lg: { box: 46, font: 18, borderWidth: 2 },
};

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  type,
  value,
  size = 'sm',
  showLabel = false,
}) => {
  const dimensions = SIZE_MAP[size];

  let displayValue: string;
  let accentColor: string;

  if (type === 'nutri') {
    const grade = typeof value === 'string' ? value.toUpperCase() : '?';
    displayValue = grade === 'UNKNOWN' ? '?' : grade;
    accentColor = getNutriScoreColor(typeof value === 'string' ? value : null);
  } else {
    const score = typeof value === 'number' ? value : null;
    displayValue = score != null ? `N${score}` : '?';
    accentColor = getNovaColor(score);
  }

  const label = type === 'nutri' ? 'Nutri' : 'NOVA';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: dimensions.box,
            height: dimensions.box,
            borderRadius: borderRadius.sm,
            borderColor: accentColor,
            borderWidth: dimensions.borderWidth,
            // Very subtle tint — 12% opacity of the accent colour
            backgroundColor: accentColor + '1F',
          },
        ]}
      >
        <Text style={[styles.text, { fontSize: dimensions.font, color: accentColor }]}>
          {displayValue}
        </Text>
      </View>
      {showLabel && (
        <Text style={[styles.label, { fontSize: size === 'lg' ? 12 : 9 }]}>
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  label: {
    marginTop: 2,
    color: '#94A3B8',
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
});

export default ScoreBadge;
