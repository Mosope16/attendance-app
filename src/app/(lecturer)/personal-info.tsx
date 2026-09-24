import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Platform, Alert, Modal, FlatList, TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { User, Hash, Phone, ChevronLeft, CheckCircle, Building2, ChevronDown, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const DEPARTMENTS = [
  'Computer Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Computer Science',
  'Information Technology',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biochemistry',
  'Microbiology',
  'Medicine & Surgery',
  'Nursing Science',
  'Pharmacy',
  'Accounting',
  'Business Administration',
  'Economics',
  'Law',
  'Architecture',
  'Other',
];

const ff = Platform.OS === 'android';

export default function LecturerPersonalInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { colors, isDark } = useTheme();

  const meta = (user?.unsafeMetadata as any) ?? {};

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [staffId, setStaffId] = useState(meta.staff_id ?? '');
  const [department, setDepartment] = useState(meta.department ?? '');
  const [phone, setPhone] = useState(meta.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [deptModal, setDeptModal] = useState(false);

  const SECONDARY = colors.secondary;

  const handleSave = async () => {
    setSaving(true);
    try {
      await user?.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        unsafeMetadata: {
          ...meta,
          staff_id: staffId.trim(),
          department: department.trim(),
          phone: phone.trim(),
        },
      });
      Alert.alert('Saved', 'Your information has been updated.');
      router.replace('/(lecturer)/profile');
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.message ?? 'Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top, 20) + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style="light" backgroundColor={isDark ? '#071A40' : SECONDARY} translucent={false} />
      
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.replace('/(lecturer)/profile')} style={s.backBtn}>
          <ChevronLeft size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={s.headerTitle}>Personal Info</Text>
        <Pressable onPress={handleSave} disabled={saving} style={s.saveBtn}>
          <CheckCircle size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Avatar row */}
      <View style={s.avatarRow}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarInitial}>
            {(firstName || user?.firstName || 'L').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={s.avatarName}>
            Dr. {lastName || user?.lastName || firstName || user?.firstName}
          </Text>
        </View>
      </View>

      {/* Form */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Basic Details</Text>

        <View style={s.field}>
          <View style={s.fieldIcon}><User size={18} color={SECONDARY} /></View>
          <View style={s.fieldBody}>
            <Text style={s.fieldLabel}>First Name</Text>
            <TextInput
              style={s.fieldInput}
              value={firstName}
              placeholder="Enter first name"
              placeholderTextColor={colors.textMuted}
              onChangeText={setFirstName}
            />
          </View>
        </View>

        <View style={[s.field, s.fieldBorder]}>
          <View style={s.fieldIcon}><User size={18} color={SECONDARY} /></View>
          <View style={s.fieldBody}>
            <Text style={s.fieldLabel}>Last Name</Text>
            <TextInput
              style={s.fieldInput}
              value={lastName}
              placeholder="Enter last name"
              placeholderTextColor={colors.textMuted}
              onChangeText={setLastName}
            />
          </View>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Academic Info</Text>

        <View style={s.field}>
          <View style={s.fieldIcon}><Hash size={18} color={SECONDARY} /></View>
          <View style={s.fieldBody}>
            <Text style={s.fieldLabel}>Staff ID</Text>
            <TextInput
              style={s.fieldInput}
              value={staffId}
              placeholder="e.g. LEC-001"
              placeholderTextColor={colors.textMuted}
              onChangeText={setStaffId}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={[s.field, s.fieldBorder]}>
          <View style={s.fieldIcon}><Building2 size={18} color={SECONDARY} /></View>
          <Pressable style={s.fieldBody} onPress={() => setDeptModal(true)}>
            <Text style={s.fieldLabel}>Department</Text>
            <View style={s.pickerRow}>
              <Text style={[s.fieldInput, !department && { color: colors.textMuted }]}>
                {department || 'Select department'}
              </Text>
              <ChevronDown size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Department Modal */}
      <Modal visible={deptModal} transparent animationType="slide" onRequestClose={() => setDeptModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setDeptModal(false)} />
        <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Select Department</Text>
            <Pressable onPress={() => setDeptModal(false)} style={s.modalClose}>
              <Text style={{ color: SECONDARY, fontWeight: '700', fontSize: 15 }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={DEPARTMENTS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.deptItem, { borderBottomColor: colors.cardBorder }, item === department && { backgroundColor: colors.secondaryDim }]}
                onPress={() => { setDepartment(item); setDeptModal(false); }}
              >
                <Text style={[s.deptItemText, { color: item === department ? SECONDARY : colors.text }]}>{item}</Text>
                {item === department && <Check size={16} color={SECONDARY} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Contact</Text>

        <View style={s.field}>
          <View style={s.fieldIcon}><Phone size={18} color={SECONDARY} /></View>
          <View style={s.fieldBody}>
            <Text style={s.fieldLabel}>Phone Number</Text>
            <TextInput
              style={s.fieldInput}
              value={phone}
              placeholder="e.g. 08012345678"
              placeholderTextColor={colors.textMuted}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      {/* Read-only email */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Account</Text>
        <View style={[s.field, s.readonlyField]}>
          <View style={s.fieldBody}>
            <Text style={s.fieldLabel}>Email Address</Text>
            <Text style={s.readonlyValue}>
              {user?.primaryEmailAddress?.emailAddress ?? '—'}
            </Text>
          </View>
          <View style={s.lockedBadge}>
            <Text style={s.lockedText}>Verified</Text>
          </View>
        </View>
      </View>

      {/* Save button */}
      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={[s.saveMainBtn, saving && { opacity: 0.6 }]}
      >
        <Text style={s.saveMainBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: { paddingBottom: 48 },
    header: {
      backgroundColor: c.secondary,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    backBtn: { width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    saveBtn: { width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
    avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    avatarInitial: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    avatarName: { fontSize: 18, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    avatarSub: { fontSize: 13, color: c.textMuted, marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    section: {
      backgroundColor: c.card, marginHorizontal: 20, marginBottom: 12,
      borderRadius: 18, borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase',
      letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
      fontFamily: ff ? 'sans-serif-medium' : undefined,
    },
    field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    fieldBorder: { borderTopWidth: 1, borderTopColor: c.cardBorder },
    fieldIcon: { width: 36, height: 36, backgroundColor: c.secondaryDim, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    fieldBody: { flex: 1 },
    fieldLabel: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: ff ? 'sans-serif-medium' : undefined },
    fieldInput: { fontSize: 15, color: c.text, fontFamily: ff ? 'sans-serif' : undefined, paddingVertical: 0 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalSheet: { maxHeight: '65%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
    modalClose: { padding: 4 },
    deptItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    deptItemText: { fontSize: 15, fontFamily: ff ? 'sans-serif' : undefined },
    readonlyField: { backgroundColor: c.cardAlt },
    readonlyValue: { fontSize: 15, color: c.text, fontFamily: ff ? 'sans-serif' : undefined },
    lockedBadge: { backgroundColor: c.secondaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    lockedText: { fontSize: 12, fontWeight: '600', color: c.secondaryText, fontFamily: ff ? 'sans-serif-medium' : undefined },
    saveMainBtn: {
      backgroundColor: c.secondary, marginHorizontal: 20, borderRadius: 999,
      paddingVertical: 16, alignItems: 'center', elevation: 2,
    },
    saveMainBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17, fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
