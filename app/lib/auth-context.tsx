import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { authMeRetrieve, tokenCreate, tokenFromSessionRetrieve } from "./api/generated/auth/auth";
import type { TokenObtainPairRequest } from "./api/generated/models";

interface User {
  username: string;
  token?: string;
  isSessionAuth?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for session auth first (Django admin login), then fall back to JWT token
    const checkAuth = async () => {
      try {
        // Try to get current user via session auth
        const response = await authMeRetrieve();

        if (response.status === 200 && response.data.username) {
          const username = response.data.username;

          // Try to get JWT tokens for API calls (avoids CSRF issues)
          try {
            const tokenResponse = await tokenFromSessionRetrieve();

            if (
              tokenResponse.status === 200 &&
              tokenResponse.data.access &&
              tokenResponse.data.refresh
            ) {
              localStorage.setItem("authToken", tokenResponse.data.access);
              localStorage.setItem("refreshToken", tokenResponse.data.refresh);
              localStorage.setItem("username", username);

              setUser({
                username,
                token: tokenResponse.data.access,
                isSessionAuth: true,
              });
              setIsLoading(false);
              return;
            }
          } catch {
            // Token fetch failed, check for existing tokens
          }

          // Fallback: use existing JWT tokens from localStorage if available
          const existingToken = localStorage.getItem("authToken");
          if (existingToken) {
            setUser({
              username,
              token: existingToken,
              isSessionAuth: true,
            });
            setIsLoading(false);
            return;
          }

          // No JWT tokens available - session-only auth (limited functionality)
          setUser({
            username,
            isSessionAuth: true,
          });
          setIsLoading(false);
          return;
        }
      } catch {
        // Session auth failed, try JWT
      }

      // Fall back to JWT token from localStorage
      const token = localStorage.getItem("authToken");
      const username = localStorage.getItem("username");
      if (token && username) {
        setUser({ username, token });
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const request: TokenObtainPairRequest = { username, password };
      const response = await tokenCreate(request);

      // Check if response was successful
      if (response.status !== 200) {
        throw new Error("ログインに失敗しました");
      }

      const token = response.data.access;
      const refreshToken = response.data.refresh;
      localStorage.setItem("authToken", token);
      localStorage.setItem("username", username);
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }

      setUser({ username, token });
    } catch (error) {
      console.error("Login error:", error);
      throw new Error("ログインに失敗しました");
    }
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
