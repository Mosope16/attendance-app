import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth, useUser } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useSupabaseClient } from '../../lib/supabase';
import {
  User, Bell, Lock, LogOut, ChevronRight, HelpCircle,
  Sun, Moon, SlidersHorizontal,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

const ff = Platform.OS === 'android';

export default function StudentProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { colors, mode, isDark, setMode } = useTheme();
  const supabase = useSupabaseClient();
  const { isPermissionGranted, requestPermission } = useNotifications();
  const PRIMARY = colors.primary;

  const [courseCount, setCourseCount] = useState<number>(0);
  const [overallPct, setOverallPct] = useState<number | null>(null);
  const [weekCount, setWeekCount] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#0D3320' : PRIMARY);
      const timer = setTimeout(() => {
        fetchStats();
      }, 150);
      return () => clearTimeout(timer);
    }, [user?.id, isDark, PRIMARY])
  );

  const fetchStats = async () => {
    if (!user) return;
    setStatsLoading(true);

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course:course_id ( id )')
      .eq('student_id', user.id);

    const enrolled = enrollments ?? [];
    setCourseCount(enrolled.length);

    if (enrolled.length === 0) { setStatsLoading(false); return; }

    const courseIds = enrolled.map((e: any) => e.course.id);
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .in('course_id', courseIds);

    const sessionIds = sessions?.map((s: any) => s.id) ?? [];
    if (sessionIds.length === 0) { setStatsLoading(false); return; }

    const { data: records } = await supabase
      .from('attendance_records')
      .select('status, timestamp')
      .eq('student_id', user.id)
      .in('session_id', sessionIds);

    const present = records?.filter((r: any) => r.status === 'present').length ?? 0;
    setOverallPct(Math.round((present / sessionIds.length) * 100));

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    setWeekCount(records?.filter((r: any) => new Date(r.timestamp) >= weekStart).length ?? 0);
    setStatsLoading(false);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const menuItems = [
    {
      icon: <User size={20} color={colors.textSub} />,
      title: 'Personal Information',
      onPress: () => router.push('/(student)/personal-info'),
    },
    {
      icon: <Bell size={20} color={isPermissionGranted ? PRIMARY : colors.textSub} />,
      title: 'Push Notifications',
      subtitle: isPermissionGranted ? 'Enabled — alerts active for enrolled courses' : 'Disabled — Tap to enable attendance alerts',
      badge: isPermissionGranted ? 'Enabled' : 'Enable',
      badgeActive: isPermissionGranted,
      onPress: async () => {
        if (!isPermissionGranted) {
          await requestPermission();
        } else {
          router.push('/(student)/notifications');
        }
      },
    },
    {
      icon: <Lock size={20} color={colors.textSub} />,
      title: 'Security & Password',
      onPress: undefined,
    },
    {
      icon: <HelpCircle size={20} color={colors.textSub} />,
      title: 'Help & Support',
      onPress: undefined,
    },
  ];

  const appearanceModes: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: 'light', label: 'Light', icon: <Sun size={16} color={mode === 'light' ? '#FFFFFF' : colors.textSub} /> },
    { key: 'dark', label: 'Dark', icon: <Moon size={16} color={mode === 'dark' ? '#FFFFFF' : colors.textSub} /> },
    { key: 'system', label: 'System', icon: <SlidersHorizontal size={16} color={mode === 'system' ? '#FFFFFF' : colors.textSub} /> },
  ];

  const s = makeStyles(colors);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
        <Text style={s.headerTitle}>Profile</Text>
      </View>

      {/* Avatar Card */}
      <View style={s.cardWrapper}>
        <View style={s.avatarCard}>
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback, { backgroundColor: PRIMARY }]}>
              <Text style={s.avatarInitial}>
                {(user?.firstName || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
          <View style={[s.roleBadge, { backgroundColor: colors.primaryDim }]}>
            <Text style={[s.roleText, { color: colors.primaryText }]}>Student</Text>
          </View>
          <Text style={s.subInfo}>Matric: {(user?.unsafeMetadata as any)?.matric_number || '—'}</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {statsLoading ? (
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            [
              { num: courseCount.toString(), label: 'Courses' },
              { num: overallPct !== null ? `${overallPct}%` : '—', label: 'Attendance' },
              { num: weekCount.toString(), label: 'This Week' },
            ].map((item) => (
              <View key={item.label} style={s.statItem}>
                <Text style={s.statNum}>{item.num}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Appearance Section */}
      <View style={s.sectionLabel}>
        <Text style={s.sectionLabelText}>Appearance</Text>
      </View>
      <View style={s.appearanceCard}>
        <Text style={s.appearanceHint}>Choose how the app looks</Text>
        <View style={s.modeRow}>
          {appearanceModes.map(({ key, label, icon }) => {
            const active = mode === key;
            return (
              <Pressable
                key={key}
                onPress={() => setMode(key)}
                style={[s.modeBtn, active && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}
              >
                {icon}
                <Text style={[s.modeBtnText, active && { color: '#FFFFFF' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Menu */}
      <View style={s.sectionLabel}>
        <Text style={s.sectionLabelText}>Account</Text>
      </View>
      <View style={s.menuCard}>
        {menuItems.map((item: any, i) => (
          <Pressable
            key={i}
            onPress={item.onPress}
            style={[s.menuItem, i < menuItems.length - 1 && s.menuItemBorder]}
          >
            <View style={s.menuIcon}>{item.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.menuText}>{item.title}</Text>
              {item.subtitle ? <Text style={s.menuSubText}>{item.subtitle}</Text> : null}
            </View>
            {item.badge ? (
              <View
                style={[
                  s.notifBadge,
                  { backgroundColor: item.badgeActive ? colors.primaryDim : '#FEE2E2' },
                ]}
              >
                <Text
                  style={[
                    s.notifBadgeText,
                    { color: item.badgeActive ? PRIMARY : '#EF4444' },
                  ]}
                >
                  {item.badge}
                </Text>
              </View>
            ) : (
              <ChevronRight size={18} color={colors.textMuted} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Logout */}
      <Pressable onPress={handleLogout} style={s.logoutBtn}>
        <LogOut size={18} color={colors.danger} style={{ marginRight: 8 }} />
        <Text style={s.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      backgroundColor: c.primary, paddingHorizontal: 20, paddingBottom: 72,
      borderBottomLeftRadius: 32, borderBottomRightRadius: 32, alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    cardWrapper: { marginHorizontal: 20, marginTop: -52, marginBottom: 8 },
    avatarCard: {
      backgroundColor: c.card, borderRadius: 24, padding: 24, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 12,
    },
    avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: c.primaryDim, marginBottom: 14 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    name: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 6, fontFamily: ff ? 'sans-serif-medium' : undefined },
    roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginBottom: 6 },
    roleText: { fontSize: 13, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    subInfo: { fontSize: 13, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    statsRow: {
      backgroundColor: c.card, borderRadius: 18, flexDirection: 'row',
      borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    statItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
    statNum: { fontSize: 20, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    statLabel: { fontSize: 11, color: c.textMuted, marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    sectionLabel: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
    sectionLabelText: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: ff ? 'sans-serif-medium' : undefined },
    appearanceCard: {
      backgroundColor: c.card, marginHorizontal: 20, borderRadius: 18,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 4, padding: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    appearanceHint: { fontSize: 13, color: c.textSub, marginBottom: 14, fontFamily: ff ? 'sans-serif' : undefined },
    modeRow: { flexDirection: 'row', gap: 8 },
    modeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.cardBorder, backgroundColor: c.cardAlt,
    },
    modeBtnText: { fontSize: 13, fontWeight: '600', color: c.textSub, fontFamily: ff ? 'sans-serif-medium' : undefined },
    menuCard: {
      backgroundColor: c.card, marginHorizontal: 20, borderRadius: 18,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    menuIcon: { width: 36, height: 36, backgroundColor: c.bg, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    menuText: { flex: 1, fontSize: 15, color: c.text, fontWeight: '500', fontFamily: ff ? 'sans-serif-medium' : undefined },
    menuSubText: { fontSize: 12, color: c.textSub, marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    notifBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    notifBadgeText: { fontSize: 12, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
    logoutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.dangerDim, marginHorizontal: 20, borderRadius: 16, paddingVertical: 16, marginTop: 8,
    },
    logoutText: { color: c.danger, fontWeight: '700', fontSize: 16, fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
