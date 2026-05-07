import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";

const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

export function meta() {
  return [{ title: "Kippo" }];
}

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      navigate("/weekly-effort", { replace: true });
    } else {
      // Users authenticate via kippo (Django) admin session, not the UI's /login.
      window.location.href = `${urlPrefix}/admin/`;
    }
  }, [user, isLoading, navigate]);

  return null;
}
