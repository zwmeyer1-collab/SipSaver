import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isSupabaseConfigured: boolean;
  isLoading: boolean;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<{ needsVerification: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const STORAGE_KEY = "sipsaver-auth-user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        const authUser = data.user;
        if (authUser?.email) {
          setUser({
            id: authUser.id,
            email: authUser.email,
            name: (authUser.user_metadata?.name as string | undefined) || authUser.email.split("@")[0],
          });
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const authUser = session?.user;
        if (!authUser?.email) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        setUser({
          id: authUser.id,
          email: authUser.email,
          name: (authUser.user_metadata?.name as string | undefined) || authUser.email.split("@")[0],
        });
        setIsLoading(false);
      });

      return () => { subscription.unsubscribe(); };
    }

    const savedUser = window.localStorage.getItem(STORAGE_KEY);
    if (!savedUser) { setIsLoading(false); return; }

    try {
      const parsedUser = JSON.parse(savedUser) as Partial<AuthUser>;
      if (parsedUser.email && parsedUser.name) {
        setUser({ id: parsedUser.id ?? `local-${parsedUser.email}`, email: parsedUser.email, name: parsedUser.name });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isSupabaseConfigured,
      isLoading,

      async signIn({ email, password }) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          return; // user state updated by onAuthStateChange
        }
        // local fallback (no Supabase)
        const localUser = { id: `local-${email}`, email, name: email.split("@")[0] };
        setUser(localUser);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser));
      },

      async signUp({ name, email, password }) {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
          });
          if (error) throw error;
          // If email confirmation is required, session is null until verified
          return { needsVerification: !data.session };
        }
        // local fallback
        const localUser = { id: `local-${email}`, email, name };
        setUser(localUser);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser));
        return { needsVerification: false };
      },

      async signOut() {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        }
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
      },

      async resetPassword(email: string) {
        if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured.");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      },

      async updatePassword(password: string) {
        if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
