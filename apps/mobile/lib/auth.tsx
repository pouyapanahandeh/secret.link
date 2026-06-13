import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getToken,
  setToken as saveToken,
  clearToken,
  usersApi,
  authApi,
} from "./api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: string;
  handle: string;
  email?: string;
  bio?: string;
  socials?: { platform: string; url: string }[];
  followersCount: number;
  followingCount: number;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (handle: string, email?: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<boolean>;
  verifyMagicLink: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  signup: async () => {},
  sendMagicLink: async () => false,
  verifyMagicLink: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored token on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (stored) {
          setTokenState(stored);
          const profile = await usersApi.me();
          setUser(profile);
        }
      } catch {
        // Token invalid or expired — clear it
        await clearToken();
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (newToken: string) => {
    await saveToken(newToken);
    setTokenState(newToken);
    const profile = await usersApi.me();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const signup = useCallback(
    async (handle: string, email?: string) => {
      const res = await authApi.signup({ handle, email: email || undefined });
      await login(res.token);
    },
    [login],
  );

  const sendMagicLink = useCallback(async (email: string) => {
    const res = await authApi.loginMagicLink(email);
    return res.sent;
  }, []);

  const verifyMagicLink = useCallback(
    async (magicToken: string) => {
      const res = await authApi.verifyMagicLink(magicToken);
      await login(res.token);
    },
    [login],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const profile = await usersApi.me();
      setUser(profile);
    } catch {}
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        signup,
        sendMagicLink,
        verifyMagicLink,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
