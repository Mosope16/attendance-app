import React, { useCallback } from 'react';
import { StatusBar, Platform } from 'react-native';
import { Tabs, useFocusEffect } from 'expo-router';
import { LayoutDashboard, BookOpen, QrCode, FileText, User } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function LecturerLayout() {
  const { colors, isDark } = useTheme();

  // Re-apply purple status bar every time a lecturer screen is focused.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(isDark ? '#071A40' : colors.secondary);
      }
    }, [isDark, colors.secondary])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
          backgroundColor: colors.bg,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color, size }) => <QrCode color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      
      {/* Hidden Screens */}
      <Tabs.Screen
        name="create-course"
        options={{
          href: null,
          title: 'Create Course',
        }}
      />
      <Tabs.Screen
        name="personal-info"
        options={{
          href: null,
          title: 'Personal Info',
        }}
      />
      <Tabs.Screen
        name="course/[id]"
        options={{
          href: null,
          title: 'Course Details',
        }}
      />
    </Tabs>
  );
}
