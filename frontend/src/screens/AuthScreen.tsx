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
  PasswordStrengthIndicator,
} from '@/components';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword' | 'resetCode';

interface AuthScreenProps {
  onSuccess: () => void;
  initialMode?: AuthMode;
  initialEmail?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, initialMode, initialEmail }) => {
  const { colors } = useTheme();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>(initialMode ?? 'signIn');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Password-reset specific state
  const [resetEmail, setResetEmail] = useState(initialEmail ?? '');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

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

      if ((res as any).tokens) {
        const { access, refresh } = (res as any).tokens;
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

  const handleForgotPassword = async () => {
    setError('');
    setSuccessMsg('');
    if (!resetEmail) {
      setError('Please enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.auth.requestPasswordReset(resetEmail);
      setSuccessMsg(res.detail);
      setMode('resetCode');
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || 'Failed to send reset email.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setSuccessMsg('');
    if (!resetCode || !newPassword || !newPasswordConfirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.auth.confirmPasswordReset({
        email: resetEmail,
        code: resetCode,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });
      setSuccessMsg(res.detail);
      // Go back to sign-in after a short delay
      setTimeout(() => {
        setMode('signIn');
        setSuccessMsg('');
        setResetEmail('');
        setResetCode('');
        setNewPassword('');
        setNewPasswordConfirm('');
      }, 2000);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data) {
        const msgs: string[] = [];
        for (const key of Object.keys(data)) {
          const val = data[key];
          if (Array.isArray(val)) msgs.push(...val);
          else if (typeof val === 'string') msgs.push(val);
        }
        setError(msgs.join(' ') || 'Password reset failed.');
      } else {
        setError('Password reset failed. Please try again.');
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
              {mode === 'signUp'
                ? 'Create your account'
                : mode === 'forgotPassword'
                  ? 'Reset your password'
                  : mode === 'resetCode'
                    ? 'Enter your reset code'
                    : 'Welcome back'}
            </Text>
          </View>

          <GlassCard blur="subtle" padding="lg" style={styles.formCard}>
            {/* ---- Sign In / Sign Up forms ---- */}
            {(mode === 'signIn' || mode === 'signUp') && (
              <>
                {mode === 'signUp' && (
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

                {mode === 'signUp' && password.length > 0 && (
                  <PasswordStrengthIndicator password={password} />
                )}

                {mode === 'signUp' &&
                  renderInput(
                    'Confirm Password',
                    confirmPassword,
                    setConfirmPassword,
                    {
                      secureTextEntry: true,
                      showToggle: true,
                      toggleVisible: showConfirmPassword,
                      onToggle: () =>
                        setShowConfirmPassword(!showConfirmPassword),
                    },
                  )}
              </>
            )}

            {/* ---- Forgot Password: enter email ---- */}
            {mode === 'forgotPassword' && (
              <>
                <Text style={[styles.infoText, { color: colors.neutral.darkGray }]}>
                  Enter the email associated with your account and we'll send you a
                  6-digit reset code.
                </Text>
                {renderInput('Email', resetEmail, setResetEmail, {
                  keyboardType: 'email-address',
                })}
              </>
            )}

            {/* ---- Reset Code: enter code + new password ---- */}
            {mode === 'resetCode' && (
              <>
                <Text style={[styles.infoText, { color: colors.neutral.darkGray }]}>
                  Check your email for a 6-digit code, then choose a new password.
                </Text>
                {renderInput('6-digit code', resetCode, setResetCode)}
                {renderInput('New Password', newPassword, setNewPassword, {
                  secureTextEntry: true,
                  showToggle: true,
                  toggleVisible: showNewPassword,
                  onToggle: () => setShowNewPassword(!showNewPassword),
                })}
                {newPassword.length > 0 && (
                  <PasswordStrengthIndicator password={newPassword} />
                )}
                {renderInput(
                  'Confirm New Password',
                  newPasswordConfirm,
                  setNewPasswordConfirm,
                  { secureTextEntry: true },
                )}
              </>
            )}

            {/* ---- Success message ---- */}
            {successMsg ? (
              <View style={[styles.successBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* ---- Error message ---- */}
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ---- Primary button ---- */}
            <GradientButton
              title={
                submitting
                  ? ''
                  : mode === 'signUp'
                    ? 'Create Account'
                    : mode === 'forgotPassword'
                      ? 'Send Reset Code'
                      : mode === 'resetCode'
                        ? 'Reset Password'
                        : 'Sign In'
              }
              onPress={
                mode === 'signUp'
                  ? handleSignUp
                  : mode === 'forgotPassword'
                    ? handleForgotPassword
                    : mode === 'resetCode'
                      ? handleResetPassword
                      : handleSignIn
              }
              disabled={submitting}
              icon={
                submitting
                  ? undefined
                  : mode === 'signUp'
                    ? 'person-add'
                    : mode === 'forgotPassword' || mode === 'resetCode'
                      ? 'mail'
                      : 'log-in'
              }
              style={styles.submitButton}
            />
            {submitting && (
              <ActivityIndicator
                color="#FFFFFF"
                style={styles.spinnerOverlay}
              />
            )}

            {/* ---- Forgot Password link (only on sign-in) ---- */}
            {mode === 'signIn' && (
              <AnimatedPressable
                onPress={() => {
                  setMode('forgotPassword');
                  setError('');
                  setSuccessMsg('');
                }}
                style={styles.toggleLink}
              >
                <Text style={[styles.toggleText, { color: colors.primary.main }]}>
                  Forgot your password?
                </Text>
              </AnimatedPressable>
            )}

            {/* ---- Toggle: Sign In / Sign Up ---- */}
            {(mode === 'signIn' || mode === 'signUp') && (
              <AnimatedPressable
                onPress={() => {
                  setMode(mode === 'signUp' ? 'signIn' : 'signUp');
                  setError('');
                  setSuccessMsg('');
                }}
                style={styles.toggleLink}
              >
                <Text
                  style={[styles.toggleText, { color: colors.neutral.darkGray }]}
                >
                  {mode === 'signUp'
                    ? 'Already have an account? '
                    : "Don't have an account? "}
                  <Text
                    style={{ color: colors.primary.main, fontWeight: '600' }}
                  >
                    {mode === 'signUp' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Text>
              </AnimatedPressable>
            )}

            {/* ---- Back to Sign In (from password-reset screens) ---- */}
            {(mode === 'forgotPassword' || mode === 'resetCode') && (
              <AnimatedPressable
                onPress={() => {
                  setMode('signIn');
                  setError('');
                  setSuccessMsg('');
                }}
                style={styles.toggleLink}
              >
                <Text style={[styles.toggleText, { color: colors.neutral.darkGray }]}>
                  <Ionicons name="arrow-back" size={14} color={colors.neutral.darkGray} />
                  {'  Back to Sign In'}
                </Text>
              </AnimatedPressable>
            )}
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  successText: {
    color: '#16A34A',
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  infoText: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.xs,
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
