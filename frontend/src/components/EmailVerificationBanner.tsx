import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useTheme,
  spacing,
  borderRadius,
  typography,
  textFont,
} from '@/theme';
import { AnimatedPressable } from '@/components/ui';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';

/**
 * Banner shown at the top of the app when the user's email is not yet verified.
 * Allows entering a 6-digit code or resending the verification email.
 */
export const EmailVerificationBanner: React.FC = () => {
  const { colors } = useTheme();
  const { user, setUser } = useAuthStore();

  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Don't render if user is already verified or missing
  if (!user || user.email_verified) return null;

  const handleVerify = async () => {
    setError('');
    setMessage('');
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.verifyEmail(code);
      setMessage('Email verified!');
      // Refresh user data
      const updated = await api.users.getCurrentUser();
      setUser(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || 'Invalid or expired code.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const res = await api.auth.resendVerification();
      setMessage(res.detail);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || 'Failed to resend email.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.banner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
      <AnimatedPressable
        onPress={() => setExpanded(!expanded)}
        style={styles.bannerHeader}
      >
        <Ionicons name="mail-outline" size={18} color="#92400E" />
        <Text style={[styles.bannerText, { color: '#92400E' }]}>
          Please verify your email address
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#92400E"
        />
      </AnimatedPressable>

      {expanded && (
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerInfo, { color: '#78350F' }]}>
            Enter the 6-digit code sent to {user.email}
          </Text>

          <View style={styles.codeRow}>
            <TextInput
              placeholder="000000"
              placeholderTextColor={colors.neutral.gray}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={[
                styles.codeInput,
                {
                  backgroundColor: colors.surface.glass,
                  borderColor: colors.surface.glassBorder,
                  color: colors.neutral.charcoal,
                },
              ]}
            />
            <AnimatedPressable
              onPress={handleVerify}
              disabled={submitting}
              style={[styles.verifyBtn, { backgroundColor: '#22C55E' }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify</Text>
              )}
            </AnimatedPressable>
          </View>

          <AnimatedPressable onPress={handleResend} disabled={submitting}>
            <Text style={[styles.resendLink, { color: '#92400E' }]}>
              Resend code
            </Text>
          </AnimatedPressable>

          {message ? (
            <Text style={[styles.bannerMsg, { color: '#16A34A' }]}>
              {message}
            </Text>
          ) : null}
          {error ? (
            <Text style={[styles.bannerMsg, { color: '#DC2626' }]}>
              {error}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerText: {
    ...textFont.semibold,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  bannerBody: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  bannerInfo: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 40,
    ...textFont.semibold,
    fontSize: typography.fontSize.lg,
    letterSpacing: 6,
    textAlign: 'center',
  },
  verifyBtn: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: {
    ...textFont.semibold,
    fontSize: typography.fontSize.sm,
    color: '#FFFFFF',
  },
  resendLink: {
    ...textFont.medium,
    fontSize: typography.fontSize.xs,
    textDecorationLine: 'underline',
  },
  bannerMsg: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
});

export default EmailVerificationBanner;
