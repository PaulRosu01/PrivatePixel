// app/auth-context.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ⚠️ Make sure this matches your backend IP / port
// e.g. "http://192.168.0.100:3001"
export const NAS_BASE_URL = "http://192.168.0.14:3001";

export type User = {
  id: string;
  email: string;
};

export type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;      // ✅ keeps your previous API idea
  initializing: boolean;    // loading auth from storage on app startup
  authLoading: boolean;     // login/register in progress
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

const STORAGE_USER_KEY = "pp_auth_user";
const STORAGE_TOKEN_KEY = "pp_auth_token";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Load saved auth (auto-login) on app start
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem(STORAGE_USER_KEY),
          AsyncStorage.getItem(STORAGE_TOKEN_KEY),
        ]);

        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }
      } catch (e) {
        console.warn("Failed to load auth state", e);
      } finally {
        setInitializing(false);
      }
    };

    loadAuth();
  }, []);

  const saveAuth = async (u: User | null, t: string | null) => {
    setUser(u);
    setToken(t);

    if (u && t) {
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
      await AsyncStorage.setItem(STORAGE_TOKEN_KEY, t);
    } else {
      await AsyncStorage.removeItem(STORAGE_USER_KEY);
      await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  };

  const callAuthEndpoint = useCallback(
    async (
      endpoint: "/auth/login" | "/auth/register",
      email: string,
      password: string
    ) => {
      setAuthLoading(true);
      try {
        const res = await fetch(`${NAS_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          const msg =
            data?.error || data?.message || "Authentication failed";
          throw new Error(msg);
        }

        const u: User = data.user;
        const t: string = data.token;

        await saveAuth(u, t);
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await callAuthEndpoint("/auth/login", email.trim(), password);
    },
    [callAuthEndpoint]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await callAuthEndpoint("/auth/register", email.trim(), password);
    },
    [callAuthEndpoint]
  );

  const logout = useCallback(async () => {
    await saveAuth(null, null);
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isLoggedIn: !!user, // ✅ replaces your old boolean
    initializing,
    authLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Convenience hook so you don’t have to use useContext(AuthContext) everywhere
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
};
