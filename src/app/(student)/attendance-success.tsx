import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function AttendanceSuccessScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const PRIMARY = colors.primary;
  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.bg} translucent={false} />
      <View style={s.iconBlock}>
        <CheckCircle size={80} color={PRIMARY} />
      </View>

      <Text style={s.title}>Attendance Recorded!</Text>
      <Text style={s.subtitle}>
        Your attendance has been successfully marked for this session.
      </Text>

      <View style={s.detailCard}>
        {[
          { label: 'Date', value: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
          { label: 'Time', value: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
          { label: 'Status', value: '✓ Present' },
        ].map((item) => (
          <View key={item.label} style={s.detailRow}>
            <Text style={s.detailLabel}>{item.label}</Text>
            <Text style={[s.detailValue, item.label === 'Status' && { color: PRIMARY }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => router.replace('/(student)')}
        style={s.btn}
      >
        <Text style={s.btnText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    iconBlock: { width: 120, height: 120, backgroundColor: c.primaryDim, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    title: { fontSize: 28, fontWeight: '700', color: c.text, marginBottom: 10, textAlign: 'center', fontFamily: ff ? 'sans-serif-medium' : undefined },
    subtitle: { fontSize: 15, color: c.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 8, fontFamily: ff ? 'sans-serif' : undefined },
    detailCard: { width: '100%', backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.cardBorder, marginBottom: 32 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    detailLabel: { fontSize: 14, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    detailValue: { fontSize: 14, fontWeight: '600', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    btn: { width: '100%', backgroundColor: c.primary, paddingVertical: 16, borderRadius: 999, alignItems: 'center', elevation: 2 },
    btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17, fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
