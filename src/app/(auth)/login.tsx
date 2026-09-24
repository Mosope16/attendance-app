import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Lock, GraduationCap, Eye, EyeOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { formatFriendlyAuthError } from '../../lib/auth';

const ff = Platform.OS === 'android';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, isLoaded } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isStudent = role === 'student';
  const themeColor = isStudent ? colors.primary : colors.secondary;

  const onSignInPress = async () => {
    if (!isLoaded || !identifier.trim() || !password) {
      setError('Please enter your credentials');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await signIn({ identifier: identifier.trim(), password });
      if (res.user) {
        router.replace('/');
      } else {
        setError(formatFriendlyAuthError(res.error || 'Invalid credentials. Please try again.'));
      }
    } catch (err: any) {
      setError(formatFriendlyAuthError(err?.message || 'An error occurred during sign in.'));
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top, 20) + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo */}
      <View style={s.logoContainer}>
        <View style={[s.logoRing, { borderColor: themeColor }]}>
          <GraduationCap size={40} color={themeColor} />
        </View>
        <Text style={s.appName}>SmartAttend</Text>
        <Text style={s.appTagline}>Attendance made simple</Text>
      </View>

      {/* Role Switcher */}
      <View style={s.roleSwitcher}>
        <Pressable onPress={() => setRole('student')} style={[s.roleBtn, isStudent && { backgroundColor: themeColor }]}>
          <Text style={[s.roleBtnText, isStudent && s.roleBtnTextActive]}>Student</Text>
        </Pressable>
        <Pressable onPress={() => setRole('lecturer')} style={[s.roleBtn, !isStudent && { backgroundColor: themeColor }]}>
          <Text style={[s.roleBtnText, !isStudent && s.roleBtnTextActive]}>Lecturer</Text>
        </Pressable>
      </View>

      {/* Error */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Fields */}
      <View style={s.fieldGroup}>
        <View style={s.inputRow}>
          <User size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.input}
            autoCapitalize="none"
            value={identifier}
            placeholder={isStudent ? 'Email or Matric Number' : 'Email or Staff ID'}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            onChangeText={setIdentifier}
          />
        </View>
        <View style={s.inputRow}>
          <Lock size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.input}
            value={password}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            onChangeText={setPassword}
          />
          <Pressable onPress={() => setShowPassword(p => !p)} style={s.eyeBtn}>
            {showPassword
              ? <EyeOff size={18} color={colors.textMuted} />
              : <Eye size={18} color={colors.textMuted} />
            }
          </Pressable>
        </View>
      </View>

      {/* Forgot */}
      <View style={s.rememberRow}>
        <View />
        <Pressable>
          <Text style={[s.forgotText, { color: themeColor }]}>Forgot Password?</Text>
        </Pressable>
      </View>

      {/* Login Button */}
      <Pressable onPress={onSignInPress} disabled={loading} style={[s.primaryBtn, { backgroundColor: loading ? colors.primaryDim : themeColor }]}>
        <Text style={s.primaryBtnText}>{loading ? 'Signing in...' : 'Login'}</Text>
      </Pressable>

      {/* Sign Up Link */}
      <View style={s.footerRow}>
        <Text style={s.footerText}>Don't have an account? </Text>
        <Pressable onPress={() => router.push({ pathname: '/(auth)/register', params: { defaultRole: role } })}>
          <Text style={[s.footerLink, { color: themeColor }]}>Sign Up</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 24, paddingBottom: 40 },
    logoContainer: { alignItems: 'center', marginBottom: 32 },
    logoRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    appName: { fontSize: 28, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    appTagline: { fontSize: 14, color: c.textSub, marginTop: 4, fontFamily: ff ? 'sans-serif' : undefined },
    roleSwitcher: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 999, padding: 4, marginBottom: 28 },
    roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
    roleBtnText: { fontSize: 14, fontWeight: '600', color: c.textSub, fontFamily: ff ? 'sans-serif-medium' : undefined },
    roleBtnTextActive: { color: '#FFFFFF' },
    errorBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16 },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 14, fontFamily: ff ? 'sans-serif' : undefined },
    fieldGroup: { gap: 12, marginBottom: 16 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.card,
    },
    input: { flex: 1, fontSize: 16, color: c.text, fontFamily: ff ? 'sans-serif' : undefined },
    eyeBtn: { padding: 4, marginLeft: 6 },
    rememberRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 28 },
    forgotText: { fontSize: 14, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    primaryBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 24, elevation: 2 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17, fontFamily: ff ? 'sans-serif-medium' : undefined },
    footerRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 24 },
    footerText: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    footerLink: { fontSize: 14, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
