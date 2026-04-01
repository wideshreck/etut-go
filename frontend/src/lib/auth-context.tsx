"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type User = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "superadmin" | "admin" | "teacher" | "student" | "parent";
  institution_id: string | null;
  institution_name: string | null;
  is_active: boolean;
  permissions: string[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    expectedRole?: string,
  ) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_ROUTES: Record<string, string> = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
  parent: "/parent/dashboard",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem("access_token");
      if (token) {
        api.setToken(token);
        try {
          const me = await api.get<User>("/api/v1/auth/me");
          setUser(me);
        } catch {
          localStorage.removeItem("access_token");
          api.setToken(null);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const login = useCallback(
    async (email: string, password: string, expectedRole?: string) => {
      const response = await api.post<{
        access_token: string;
        user: User;
      }>("/api/v1/auth/login", { email, password });

      if (expectedRole && response.user.role !== expectedRole) {
        throw new Error("Bu hesap seçtiğiniz portal için yetkili değil");
      }

      localStorage.setItem("access_token", response.access_token);
      api.setToken(response.access_token);
      setUser(response.user);

      const route = ROLE_ROUTES[response.user.role] || "/";
      router.push(route);
    },
    [router],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    api.setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === "superadmin") return true;
      return user.permissions?.includes(permission) ?? false;
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, hasPermission }}
    >
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
