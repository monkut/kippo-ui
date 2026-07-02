import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";

export type UseAuthGateReturn = {
  user: ReturnType<typeof useAuth>["user"];
  authLoading: boolean;
};

/**
 * Redirect to /login once auth has resolved and there is no user. Returns the
 * current user and auth-loading flag so route components can gate their render.
 */
export function useAuthGate(): UseAuthGateReturn {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  return { user, authLoading };
}
