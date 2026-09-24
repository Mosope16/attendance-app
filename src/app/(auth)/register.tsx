import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { User, Lock, Mail, Hash, GraduationCap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { formatFriendlyAuthError } from '../../lib/auth';

const ff = Platform.OS === 'android';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { signUp, isLoaded } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  useEffect(() => {
    if (params.defaultRole === 'student' || params.defaultRole === 'lecturer') {
      setRole(params.defaultRole as any);
    }
  }, [params.defaultRole]);

  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isStudent = role === 'student';
  const themeColor = isStudent ? colors.primary : colors.secondary;

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    if (!name.trim() || !emailAddress.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isStudent && !matricNumber.trim()) {
      setError('Please enter your Matric Number.');
      return;
    }
    if (!isStudent && !staffId.trim()) {
      setError('Please enter your Staff ID.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await signUp({
        name: name.trim(),
        email: emailAddress.trim(),
        password,
        role,
        matricNumber: isStudent ? matricNumber.trim() : undefined,
        staffId: !isStudent ? staffId.trim() : undefined,
      });

      if (res.user) {
        router.replace('/');
      } else {
        setError(formatFriendlyAuthError(res.error || 'Registration failed. Please try again.'));
      }
    } catch (err: any) {
      setError(formatFriendlyAuthError(err?.message || 'An error occurred during registration.'));
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
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Logo */}
      <View style={s.logoContainer}>
        <View style={[s.logoRing, { borderColor: themeColor }]}>
          <GraduationCap size={32} color={themeColor} />
        </View>
        <Text style={s.appName}>Create Account</Text>
        <Text style={s.appTagline}>Join the attendance system</Text>
      </View>

      {/* Role Switcher */}
      <View style={s.roleSwitcher}>
        <Pressable
          onPress={() => setRole('student')}
          style={[s.roleBtn, isStudent && { backgroundColor: themeColor }]}
        >
          <Text style={[s.roleBtnText, isStudent && s.roleBtnTextActive]}>Student</Text>
        </Pressable>
        <Pressable
          onPress={() => setRole('lecturer')}
          style={[s.roleBtn, !isStudent && { backgroundColor: themeColor }]}
        >
          <Text style={[s.roleBtnText, !isStudent && s.roleBtnTextActive]}>Lecturer</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Fields */}
      <View style={s.fieldGroup}>
        <View style={s.inputRow}>
          <User size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={s.input} value={name} placeholder="Full Name" placeholderTextColor={colors.textMuted} onChangeText={setName} />
        </View>
        <View style={s.inputRow}>
          <Mail size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={s.input} autoCapitalize="none" value={emailAddress} placeholder="Email Address" placeholderTextColor={colors.textMuted} keyboardType="email-address" onChangeText={setEmailAddress} />
        </View>
        <View style={s.inputRow}>
          <Hash size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.input}
            value={isStudent ? matricNumber : staffId}
            placeholder={isStudent ? 'Matric Number (e.g. 19/1234)' : 'Staff ID (e.g. LEC-001)'}
            placeholderTextColor={colors.textMuted}
            onChangeText={isStudent ? setMatricNumber : setStaffId}
          />
        </View>
        <View style={s.inputRow}>
          <Lock size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={s.input} value={password} placeholder="Create Password" placeholderTextColor={colors.textMuted} secureTextEntry onChangeText={setPassword} />
        </View>
      </View>

      <Pressable onPress={onSignUpPress} disabled={loading} style={[s.primaryBtn, { backgroundColor: loading ? colors.primaryDim : themeColor }]}>
        <Text style={s.primaryBtnText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
      </Pressable>

      <View style={s.footerRow}>
        <Text style={s.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={[s.footerLink, { color: themeColor }]}>Sign In</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 24, paddingBottom: 48 },
    logoContainer: { alignItems: 'center', marginBottom: 28 },
    logoRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    appName: { fontSize: 26, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    appTagline: { fontSize: 14, color: c.textSub, marginTop: 4, fontFamily: ff ? 'sans-serif' : undefined },
    roleSwitcher: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 999, padding: 4, marginBottom: 24 },
    roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
    roleBtnText: { fontSize: 14, fontWeight: '600', color: c.textSub, fontFamily: ff ? 'sans-serif-medium' : undefined },
    roleBtnTextActive: { color: '#FFFFFF' },
    errorBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16 },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 14, fontFamily: ff ? 'sans-serif' : undefined },
    fieldGroup: { gap: 12, marginBottom: 24 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.card },
    input: { flex: 1, fontSize: 15, color: c.text, fontFamily: ff ? 'sans-serif' : undefined },
    primaryBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 24, elevation: 2 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17, fontFamily: ff ? 'sans-serif-medium' : undefined },
    footerRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
    footerText: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    footerLink: { fontSize: 14, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
