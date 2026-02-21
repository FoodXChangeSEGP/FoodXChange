/**
 * AuthScreen - Sign Up / Sign In with glassmorphic design.
 * Features:
 *  - Toggle between Sign In and Sign Up
 *  - Password visibility toggle with eye icon
 *  - First name, last name, email, password, confirm password fields
 *  - Validates passwords match before submit
 *  - Returns JWT tokens on register (auto-login)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useTheme,
  spacing,
  borderRadius,
  typography,
  textFont,
} from '@/theme';
import {
  GlassCard,
  AnimatedPressable,
  GradientButton,
} from '@/components';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';

interface AuthScreenProps {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { colors } = useTheme();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      const tokens = await api.auth.login(email, password);
      const user = await api.users.getCurrentUser();
      setUser(user);
      setAuthenticated(true);
      onSuccess();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Invalid email or password.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.auth.register({
        username: email.toLowerCase(),
        email: email.toLowerCase(),
        password,
        password_confirm: confirmPassword,
        first_name: firstName,
        last_name: lastName,
      });

      // Registration now returns tokens — auto-login
      if ((res as any).tokens) {
        const { access, refresh } = (res as any).tokens;
        // Store tokens (api.auth.login already does this, but register returns them inline)
        const TokenStorage = {
          setItemAsync: async (key: string, value: string) => {
            if (Platform.OS === 'web') {
              try { localStorage.setItem(key, value); } catch {}
              return;
            }
            const SecureStore = await import('expo-secure-store');
            await SecureStore.setItemAsync(key, value);
          },
        };
        await TokenStorage.setItemAsync('foodxchange_auth_token', access);
        await TokenStorage.setItemAsync('foodxchange_refresh_token', refresh);
      }

      const user = await api.users.getCurrentUser();
      setUser(user);
      setAuthenticated(true);
      onSuccess();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data) {
        // Collect all field errors
        const msgs: string[] = [];
        for (const key of Object.keys(data)) {
          const val = data[key];
          if (Array.isArray(val)) msgs.push(...val);
          else if (typeof val === 'string') msgs.push(val);
        }
        setError(msgs.join(' ') || 'Registration failed.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = (
    placeholder: string,
    value: string,
    onChange: (t: string) => void,
    options?: {
      secureTextEntry?: boolean;
      showToggle?: boolean;
      toggleVisible?: boolean;
      onToggle?: () => void;
      keyboardType?: 'email-address' | 'default';
      autoCapitalize?: 'none' | 'words' | 'sentences';
    },
  ) => (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor: colors.surface.glass,
          borderColor: colors.surface.glassBorder,
        },
      ]}
    >
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.neutral.gray}
        value={value}
        onChangeText={onChange}
        secureTextEntry={options?.secureTextEntry && !options?.toggleVisible}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize={options?.autoCapitalize ?? 'none'}
        style={[
          styles.input,
          { color: colors.neutral.charcoal },
        ]}
      />
      {options?.showToggle && (
        <AnimatedPressable
          onPress={options.onToggle}
          style={styles.eyeButton}
        >
          <Ionicons
            name={options.toggleVisible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.neutral.gray}
          />
        </AnimatedPressable>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[colors.primary.main, colors.primary.light] as const}
              style={styles.logoGradient}
            >
              <Ionicons name="leaf" size={36} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.primary.main }]}>
              FoodXchange
            </Text>
            <Text style={[styles.subtitle, { color: colors.neutral.gray }]}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Text>
          </View>

          {/* Form */}
          <GlassCard blur="subtle" padding="lg" style={styles.formCard}>
            {isSignUp && (
              <View style={styles.nameRow}>
                <View style={styles.halfInput}>
                  {renderInput('First Name', firstName, setFirstName, {
                    autoCapitalize: 'words',
                  })}
                </View>
                <View style={styles.halfInput}>
                  {renderInput('Last Name', lastName, setLastName, {
                    autoCapitalize: 'words',
                  })}
                </View>
              </View>
            )}

            {renderInput('Email', email, setEmail, {
              keyboardType: 'email-address',
            })}

            {renderInput('Password', password, setPassword, {
              secureTextEntry: true,
              showToggle: true,
              toggleVisible: showPassword,
              onToggle: () => setShowPassword(!showPassword),
            })}

            {isSignUp &&
              renderInput(
                'Confirm Password',
                confirmPassword,
                setConfirmPassword,
                {
                  secureTextEntry: true,
                  showToggle: true,
                  toggleVisible: showConfirmPassword,
                  onToggle: () => setShowConfirmPassword(!showConfirmPassword),
                },
              )}

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <GradientButton
              title={submitting ? '' : isSignUp ? 'Create Account' : 'Sign In'}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={submitting}
              icon={submitting ? undefined : isSignUp ? 'person-add' : 'log-in'}
              style={styles.submitButton}
            />
            {submitting && (
              <ActivityIndicator
                color="#FFFFFF"
                style={styles.spinnerOverlay}
              />
            )}

            <AnimatedPressable
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              style={styles.toggleLink}
            >
              <Text style={[styles.toggleText, { color: colors.neutral.darkGray }]}>
                {isSignUp
                  ? 'Already have an account? '
                  : "Don't have an account? "}
                <Text style={{ color: colors.primary.main, fontWeight: '600' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </AnimatedPressable>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...textFont.bold,
    fontSize: typography.fontSize['3xl'],
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    ...textFont.regular,
    fontSize: typography.fontSize.base,
    marginTop: spacing.xs,
  },
  formCard: {
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: {
    flex: 1,
    ...textFont.regular,
    fontSize: typography.fontSize.base,
    height: '100%',
  },
  eyeButton: {
    padding: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  errorText: {
    color: '#DC2626',
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  spinnerOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 80,
  },
  toggleLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    ...textFont.regular,
    fontSize: typography.fontSize.base,
  },
});

export default AuthScreen;
