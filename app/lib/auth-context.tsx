import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { tokenCreate } from "./api/generated/token/token";
import type { TokenObtainPairRequest } from "./api/generated/models";

interface User {
  username: string;
  token: string;
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
    // Check for existing token on mount
    const token = localStorage.getItem("authToken");
    const username = localStorage.getItem("username");
    if (token && username) {
      // Token exists - restore user state
      setUser({ username, token });
    }
    setIsLoading(false);
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
