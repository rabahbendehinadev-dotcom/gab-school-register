import { createContext, useContext, ReactNode } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLogin, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import type { StaffMember } from "@workspace/api-client-react";

export type AuthUser = StaffMember & { permissions: string[] };

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    id: data.id,
    username: data.username,
    fullName: data.fullName,
    role: data.role,
    createdAt: data.createdAt,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: getGetMeQueryKey(),
    queryFn: fetchMe,
    retry: false,
    staleTime: Infinity,
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        setLocation("/gab-c7x2p/login");
      }
    }
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
