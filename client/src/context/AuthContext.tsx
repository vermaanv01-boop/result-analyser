import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import type {
  RegisterParticipantPayload,
  RegisterParticipantResponse,
  User,
} from "../types/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isJudge: boolean;
  isParticipant: boolean;
  login: (email: string, pass: string) => Promise<User>;
  registerParticipant: (data: RegisterParticipantPayload) => Promise<RegisterParticipantResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("karvaan_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("karvaan_token");
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!localStorage.getItem("karvaan_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
      localStorage.setItem("karvaan_user", JSON.stringify(res.user));
    } catch {
      api.logout();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener("karvaan_auth_expired", handleExpired);
    return () => window.removeEventListener("karvaan_auth_expired", handleExpired);
  }, []);

  const login = async (email: string, pass: string): Promise<User> => {
    const res = await api.login(email, pass);
    setUser(res.user);
    setToken(res.token);
    return res.user;
  };

  const registerParticipant = async (
    data: RegisterParticipantPayload,
  ): Promise<RegisterParticipantResponse> => {
    const res = await api.registerParticipant(data);
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
  };

  const isAdmin = user?.role === "admin";
  const isJudge = user?.role === "judge";
  const isParticipant = user?.role === "participant";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        isJudge,
        isParticipant,
        login,
        registerParticipant,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
