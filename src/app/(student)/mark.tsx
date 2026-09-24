import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, StatusBar, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanLine, ChevronLeft, Hash, Camera, X, CheckCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import * as Haptics from 'expo-haptics';

const ff = Platform.OS === 'android';

export default function MarkAttendanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const { colors, isDark } = useTheme();
  const PRIMARY = colors.primary;

  const [mode, setMode] = useState<'code' | 'scan'>('code');
  const [code, setCode] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const inputRefs = useRef<any[]>([]);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mode === 'scan') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mode]);

  // Restore primary status bar on focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#0D3320' : PRIMARY);
    }, [isDark, PRIMARY])
  );

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text.toUpperCase();
    setCode(newCode);
    if (text && index < 4) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitCode = async (attendanceCode: string) => {
    if (!user || attendanceCode.length < 5) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, course_id')
      .eq('attendance_code', attendanceCode.toUpperCase())
      .gt('end_time', now)
      .single();

    if (sessionError || !session) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Invalid or expired code. Try again.');
      setLoading(false);
      setScanned(false);
      return;
    }

    const { error: recordError } = await supabase.from('attendance_records').insert({
      session_id: session.id,
      student_id: user.id,
      status: 'present',
    });

    setLoading(false);

    if (recordError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (recordError.code === '23505') {
        setError('You already marked attendance for this session.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setScanned(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess('Attendance marked successfully!');
      setTimeout(() => router.push('/(student)/attendance-success'), 1000);
    }
  };

  const handleManualSubmit = () => {
    const fullCode = code.join('');
    if (fullCode.length < 5) { setError('Please enter the full 5-character code.'); return; }
    submitCode(fullCode);
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // QR code may contain plain code or JSON like { code: 'XXXXX' }
    let parsedCode = data;
    try {
      const parsed = JSON.parse(data);
      if (parsed.code) parsedCode = parsed.code;
    } catch {}

    if (parsedCode && parsedCode.length === 5) {
      submitCode(parsedCode);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Invalid QR code. Make sure you scan the attendance QR.');
      setScanned(false);
    }
  };

  const switchToScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera permission is required to scan QR codes.');
        return;
      }
    }
    setError('');
    setSuccess('');
    setScanned(false);
    setMode('scan');
  };

  const s = makeStyles(colors);

  // ── QR Scanner mode ──────────────────────────────────────────────────────────
  if (mode === 'scan') {
    return (
      <View style={s.root}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />

        {/* Overlay */}
        <View style={s.scanOverlay}>
          {/* Top bar */}
          <View style={[s.scanHeader, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
            <Pressable onPress={() => { setMode('code'); setScanned(false); setError(''); }} style={s.scanClose}>
              <X size={22} color="#FFF" />
            </Pressable>
            <Text style={s.scanTitle}>Scan Attendance QR</Text>
          </View>

          {/* Viewfinder */}
          <View style={s.finderWrapper}>
            <Animated.View style={[s.finder, { opacity: pulseAnim }]}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
            </Animated.View>
          </View>

          {/* Bottom hint */}
          <View style={[s.scanBottom, { paddingBottom: Math.max(insets.bottom, 20) + 40 }]}>
            {loading ? (
              <View style={s.scanFeedback}>
                <Text style={s.scanFeedbackText}>Verifying...</Text>
              </View>
            ) : success ? (
              <View style={[s.scanFeedback, { backgroundColor: '#059669' }]}>
                <CheckCircle size={18} color="#FFF" />
                <Text style={s.scanFeedbackText}>{success}</Text>
              </View>
            ) : error ? (
              <View style={[s.scanFeedback, { backgroundColor: '#DC2626' }]}>
                <Text style={s.scanFeedbackText}>{error}</Text>
              </View>
            ) : (
              <Text style={s.scanHint}>Point your camera at the QR code displayed by your lecturer</Text>
            )}

            <Pressable onPress={() => { setMode('code'); setScanned(false); setError(''); }} style={s.switchBtn}>
              <Hash size={16} color={PRIMARY} />
              <Text style={[s.switchBtnText, { color: PRIMARY }]}>Enter code manually</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Manual code mode ─────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={s.headerTitle}>Mark Attendance</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Icon */}
        <View style={s.iconBlock}>
          <View style={s.iconCircle}>
            <ScanLine size={48} color={PRIMARY} />
          </View>
          <Text style={s.iconTitle}>Join Attendance</Text>
          <Text style={s.iconSub}>
            Enter the 5-character session code from your lecturer, or scan the QR code.
          </Text>
        </View>

        {/* Feedback */}
        {error ? (
          <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
        ) : null}
        {success ? (
          <View style={s.successBox}>
            <CheckCircle size={16} color="#059669" />
            <Text style={s.successText}>{success}</Text>
          </View>
        ) : null}

        {/* Code Boxes */}
        <View style={s.codeRow}>
          {code.map((char, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              value={char}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              maxLength={1}
              autoCapitalize="characters"
              style={[
                s.codeInput,
                char ? { borderColor: PRIMARY, backgroundColor: colors.primaryDim, color: colors.primaryText } : {},
              ]}
            />
          ))}
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleManualSubmit}
          disabled={loading}
          style={[s.submitBtn, { backgroundColor: loading ? colors.primaryDim : PRIMARY }]}
        >
          <Text style={s.submitText}>{loading ? 'Verifying...' : 'Submit Code'}</Text>
        </Pressable>

        {/* QR scan toggle */}
        <Pressable onPress={switchToScan} style={s.qrBtn}>
          <Camera size={20} color={PRIMARY} style={{ marginRight: 8 }} />
          <Text style={s.qrText}>Scan QR Code Instead</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      backgroundColor: c.primary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
      flexDirection: 'row', alignItems: 'center',
    },
    backBtn: { width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
    iconBlock: { alignItems: 'center', marginBottom: 32 },
    iconCircle: { width: 96, height: 96, backgroundColor: c.primaryDim, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    iconTitle: { fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 10, fontFamily: ff ? 'sans-serif-medium' : undefined },
    iconSub: { fontSize: 14, color: c.textSub, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12, fontFamily: ff ? 'sans-serif' : undefined },
    errorBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16 },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 14, fontFamily: ff ? 'sans-serif' : undefined },
    successBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D1FAE5', padding: 12, borderRadius: 12, marginBottom: 16 },
    successText: { color: '#059669', fontSize: 14, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
    codeInput: {
      width: 54, height: 64, backgroundColor: c.card,
      borderWidth: 1.5, borderColor: c.cardBorder, borderRadius: 16,
      textAlign: 'center', fontSize: 24, fontWeight: '700', color: c.text,
      fontFamily: ff ? 'sans-serif-medium' : undefined,
    },
    submitBtn: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', marginBottom: 16, elevation: 2 },
    submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17, fontFamily: ff ? 'sans-serif-medium' : undefined },
    qrBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      paddingVertical: 14, borderRadius: 999,
    },
    qrText: { fontSize: 15, fontWeight: '600', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },

    // Scanner styles
    scanOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }, // Darkened slightly for better contrast
    scanHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 12,
      zIndex: 10,
    },
    scanClose: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    scanTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    finderWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    finder: { width: 260, height: 260, position: 'relative' },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: c.primary, borderWidth: 5 },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
    scanBottom: { alignItems: 'center', paddingHorizontal: 24, gap: 16 },
    scanFeedback: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
    },
    scanFeedbackText: { color: '#FFF', fontSize: 14, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    scanHint: { color: 'rgba(255,255,255,0.9)', fontSize: 14, textAlign: 'center', lineHeight: 22, fontFamily: ff ? 'sans-serif' : undefined },
    switchBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999,
    },
    switchBtnText: { fontSize: 15, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
