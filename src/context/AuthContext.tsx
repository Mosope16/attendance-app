import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { neonAuth, UserProfile } from '../lib/auth';
import { db } from '../lib/neon';

export interface AppUser extends UserProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  primaryEmailAddress?: { emailAddress: string };
  unsafeMetadata: {
    role: 'student' | 'lecturer';
    matric_number?: string | null;
    staff_id?: string | null;
    department?: string | null;
    phone?: string | null;
  };
  update: (params: {
    firstName?: string;
    lastName?: string;
    name?: string;
    unsafeMetadata?: Record<string, any>;
  }) => Promise<void>;
}

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AppUser | null;
  signIn: typeof neonAuth.signIn;
  signUp: typeof neonAuth.signUp;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoaded: false,
  isSignedIn: false,
  user: null,
  signIn: async () => ({ user: null, error: null }),
  signUp: async () => ({ user: null, error: null }),
  signOut: async () => {},
  refreshUser: async () => {},
});

function toAppUser(profile: UserProfile | null, onRefresh: () => Promise<void>): AppUser | null {
  if (!profile) return null;
  const parts = (profile.name || '').trim().split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  return {
    ...profile,
    fullName: profile.name,
    firstName,
    lastName,
    imageUrl: (profile as any).image_url || (profile as any).imageUrl || (profile as any).avatar_url || '',
    primaryEmailAddress: { emailAddress: profile.email },
    unsafeMetadata: {
      role: profile.role,
      matric_number: profile.matric_number,
      staff_id: profile.staff_id,
      department: profile.department,
      phone: profile.phone,
    },
    update: async (params) => {
      const updatedName = (params.firstName !== undefined || params.lastName !== undefined)
        ? `${params.firstName ?? firstName} ${params.lastName ?? lastName}`.trim()
        : params.name;

      const meta = params.unsafeMetadata || {};
      const updates: Record<string, any> = {};
      if (updatedName) updates.name = updatedName;
      if (meta.matric_number !== undefined) updates.matric_number = meta.matric_number;
      if (meta.staff_id !== undefined) updates.staff_id = meta.staff_id;
      if (meta.department !== undefined) updates.department = meta.department;
      if (meta.phone !== undefined) updates.phone = meta.phone;

      if (Object.keys(updates).length > 0) {
        await db.from('users').update(updates).eq('id', profile.id);
        await onRefresh();
      }
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const refreshUser = async () => {
    if (!userProfile?.id) return;
    const updated = await neonAuth.refreshProfile(userProfile.id);
    if (updated) {
      setUserProfile(updated);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await neonAuth.getStoredSession();
        if (mounted && session?.user) {
          setUserProfile(session.user);
        }
      } catch (err) {
        console.error('Error restoring auth session:', err);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (params: Parameters<typeof neonAuth.signIn>[0]) => {
    const res = await neonAuth.signIn(params);
    if (res.user) {
      setUserProfile(res.user);
    }
    return res;
  };

  const signUp = async (params: Parameters<typeof neonAuth.signUp>[0]) => {
    const res = await neonAuth.signUp(params);
    if (res.user) {
      setUserProfile(res.user);
    }
    return res;
  };

  const signOut = async () => {
    await neonAuth.signOut();
    setUserProfile(null);
  };

  const appUser = useMemo(() => toAppUser(userProfile, refreshUser), [userProfile]);

  const value = useMemo(
    () => ({
      isLoaded,
      isSignedIn: !!userProfile,
      user: appUser,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [isLoaded, userProfile, appUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const { isLoaded, isSignedIn, user, signOut, signIn, signUp } = useContext(AuthContext);
  return {
    isLoaded,
    isSignedIn,
    userId: user?.id ?? null,
    signOut,
    signIn,
    signUp,
  };
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useContext(AuthContext);
  return {
    isLoaded,
    isSignedIn,
    user,
  };
}
