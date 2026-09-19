import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { mapUser } from "../lib/mappers";
import { fetchUserProfile, upsertUserProfile } from "../services/userService";
import type { Role, User } from "../types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; user?: User }>;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string): Promise<User | null> => {
    try {
      // 1. Direct query to public.users
      const { data: userProfile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (userProfile && !error) {
        const mapped = mapUser(userProfile);
        setUser(mapped);
        return mapped;
      }

      // 2. Fallback to auth.users metadata if public.users is not yet synced
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authUser && authUser.id === userId) {
        const rawRole = (
          authUser.user_metadata?.role ||
          authUser.app_metadata?.role ||
          "CUSTOMER"
        ).toUpperCase();
        const role: Role =
          rawRole === "ADMIN"
            ? "ADMIN"
            : rawRole === "SUPPORT_AGENT"
            ? "SUPPORT_AGENT"
            : "CUSTOMER";
        const mapped: User = {
          id: authUser.id,
          name:
            authUser.user_metadata?.name ||
            authUser.user_metadata?.full_name ||
            authUser.email?.split("@")[0] ||
            "User",
          email: authUser.email || "",
          role,
          isApproved: role !== "SUPPORT_AGENT" || authUser.user_metadata?.is_approved === true,
          approvalStatus: role === "SUPPORT_AGENT" ? "PENDING" : "APPROVED",
        };
        setUser(mapped);
        return mapped;
      }

      const profile = await fetchUserProfile(userId);
      setUser(profile);
      return profile;
    } catch (err) {
      console.warn("loadProfile exception, falling back:", err);
      const profile = await fetchUserProfile(userId);
      setUser(profile);
      return profile;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setLoading(false);
          return { error: error.message };
        }
        if (data.user) {
          setSession(data.session);
          const profile = await loadProfile(data.user.id);
          setLoading(false);
          return { user: profile || undefined };
        }
        setLoading(false);
        return {};
      } catch (err) {
        setLoading(false);
        return { error: err instanceof Error ? err.message : "Failed to sign in." };
      }
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async (params: { name: string; email: string; password: string; role: Role }) => {
      const normalizedRole = params.role.toUpperCase() as Role;
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: { name: params.name, role: normalizedRole },
        },
      });

      if (error) return { error: error.message };
      if (!data.user) return { error: "Registration failed. Please try again." };

      try {
        await upsertUserProfile({
          id: data.user.id,
          name: params.name,
          email: params.email,
          role: normalizedRole,
          isApproved: normalizedRole !== "SUPPORT_AGENT",
        });
      } catch (profileError) {
        const message = profileError instanceof Error ? profileError.message : "Profile creation failed.";
        return { error: message };
      }

      if (data.session) {
        setSession(data.session);
        await loadProfile(data.user.id);
      }

      return {};
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async (): Promise<User | null> => {
    if (session?.user) {
      return await loadProfile(session.user.id);
    }
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      return await loadProfile(data.user.id);
    }
    return null;
  }, [loadProfile, session?.user]);

  const value = useMemo(
    () => ({ user, session, loading, signIn, signUp, signOut, refreshProfile }),
    [user, session, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
