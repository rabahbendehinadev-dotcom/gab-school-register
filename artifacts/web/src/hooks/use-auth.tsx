import { createContext, useContext, ReactNode } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLogin, useLogout, getGetMeQueryKey, getMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import type { StaffMember } from "@workspace/api-client-react";

type AuthContextType = {
  user: StaffMember | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: () => getMe(),
    retry: false,
    staleTime: Infinity,
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        setLocation("/admin/login");
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
