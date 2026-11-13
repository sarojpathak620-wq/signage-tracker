'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, UserRole } from '@/lib/types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { INITIAL_PROFILES } from '@/lib/demo-data';

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  loading: boolean;
  isSupabaseLive: boolean;
  profileError: string | null;
  login: (email: string, password?: string) => Promise<Profile | null>;
  loginAsDemo: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'st_active_auth_profile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const isSupabaseLive = isSupabaseConfigured();

  // Initialize auth
  useEffect(() => {
    async function initAuth() {
      if (isSupabaseLive) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*, unit:units(*)')
              .eq('id', session.user.id)
              .single();

            if (error) {
              console.error('Profile fetch error:', error);
              setProfileError(
                `Could not load your profile from the database. Error: ${error.message}. ` +
                `Please check that the profiles table has a row with your user ID and that RLS policies allow SELECT.`
              );
              setLoading(false);
              return;
            }

            if (profile) {
              setUser({ ...profile, email: session.user.email });
              setProfileError(null);
              setLoading(false);
              return;
            } else {
              setProfileError(
                'Your profile was not found in the database. Please ask an admin to add your profile row in the profiles table.'
              );
              setLoading(false);
              return;
            }
          }
        } catch (e: any) {
          console.warn('Supabase session fetch error:', e);
          // No session — user is not logged in, fall through to demo check
        }
      }

      // Demo mode only: check localStorage for demo profile
      if (!isSupabaseLive) {
        try {
          const stored = localStorage.getItem(AUTH_STORAGE_KEY);
          if (stored) {
            setUser(JSON.parse(stored));
          } else {
            const defaultAdmin = INITIAL_PROFILES[0];
            setUser(defaultAdmin);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaultAdmin));
          }
        } catch {
          setUser(INITIAL_PROFILES[0]);
        }
      }
      setLoading(false);
    }

    initAuth();
  }, [isSupabaseLive]);

  const login = async (email: string, password?: string): Promise<Profile | null> => {
    setLoading(true);
    setProfileError(null);
    try {
      if (isSupabaseLive && password) {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.user) {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*, unit:units(*)')
            .eq('id', data.user.id)
            .single();

          if (profileErr) {
            setProfileError(
              `Logged in successfully, but could not load your profile. Error: ${profileErr.message}. ` +
              `Please check that RLS policies allow SELECT on the profiles table.`
            );
            setLoading(false);
            return null; // Auth succeeded, but profile failed
          }

          if (profile) {
            const fullProfile = { ...profile, email: data.user.email };
            setUser(fullProfile);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fullProfile));
            setLoading(false);
            return fullProfile;
          }
        }
      }

      // Demo mode: match demo profiles
      if (!isSupabaseLive) {
        const found = INITIAL_PROFILES.find(p => p.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          setUser(found);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(found));
          setLoading(false);
          return found;
        }
      }

      throw new Error('User not found. Check your email and password.');
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginAsDemo = (targetRole: UserRole) => {
    setProfileError(null);
    const demoUser = INITIAL_PROFILES.find(p => p.role === targetRole) || INITIAL_PROFILES[0];
    setUser(demoUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
  };

  const logout = async () => {
    if (isSupabaseLive) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Supabase signOut error:', e);
      }
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setProfileError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading,
        isSupabaseLive,
        profileError,
        login,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
