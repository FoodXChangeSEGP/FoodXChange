import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, spacing, borderRadius, typography, textFont } from '@/theme';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface StrengthCheck {
  label: string;
  met: boolean;
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

const STRENGTH_CONFIG: Record<StrengthLevel, { color: string; label: string }> = {
  weak:   { color: '#EF4444', label: 'Weak' },
  fair:   { color: '#FB923C', label: 'Fair' },
  good:   { color: '#FBBF24', label: 'Good' },
  strong: { color: '#22C55E', label: 'Strong' },
};

function getStrengthChecks(password: string): StrengthCheck[] {
  return [
    { label: 'At least 8 characters',        met: password.length >= 8 },
    { label: 'Contains uppercase letter',     met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter',     met: /[a-z]/.test(password) },
    { label: 'Contains a number',             met: /\d/.test(password) },
    { label: 'Contains special character',    met: /[^A-Za-z0-9]/.test(password) },
  ];
}

function getStrengthLevel(checks: StrengthCheck[]): StrengthLevel {
  const metCount = checks.filter((c) => c.met).length;
  if (metCount <= 1) return 'weak';
  if (metCount <= 2) return 'fair';
  if (metCount <= 3) return 'good';
  return 'strong';
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
}) => {
  const { colors } = useTheme();

  const checks = useMemo(() => getStrengthChecks(password), [password]);
  const strength = useMemo(() => getStrengthLevel(checks), [checks]);
  const config = STRENGTH_CONFIG[strength];
  const metCount = checks.filter((c) => c.met).length;

  if (!password) return null;

  return (
    <View style={styles.container}>
      {/* Strength bar */}
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((i) => {
          const filledSegments =
            strength === 'weak' ? 1 : strength === 'fair' ? 2 : strength === 'good' ? 3 : 4;
          return (
            <View
              key={i}
              style={[
                styles.barSegment,
                {
                  backgroundColor:
                    i < filledSegments ? config.color : colors.surface.glassBorder,
                },
              ]}
            />
          );
        })}
        <Text style={[styles.strengthLabel, { color: config.color }]}>
          {config.label}
        </Text>
      </View>

      {/* Checklist */}
      <View style={styles.checkList}>
        {checks.map((check) => (
          <View key={check.label} style={styles.checkRow}>
            <Text style={[styles.checkIcon, { color: check.met ? '#22C55E' : colors.neutral.gray }]}>
              {check.met ? '✓' : '○'}
            </Text>
            <Text
              style={[
                styles.checkText,
                { color: check.met ? colors.neutral.darkGray : colors.neutral.gray },
              ]}
            >
              {check.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.sm,
  },
  strengthLabel: {
    ...textFont.semibold,
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.xs,
    minWidth: 44,
    textAlign: 'right',
  },
  checkList: {
    gap: 2,
    marginTop: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  checkIcon: {
    ...textFont.bold,
    fontSize: typography.fontSize.sm,
    width: 14,
    textAlign: 'center',
  },
  checkText: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
  },
});

export default PasswordStrengthIndicator;
