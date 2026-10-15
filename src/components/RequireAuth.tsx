import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p role="status" className="mx-auto max-w-md px-5 pt-10 text-[15px] text-muted">
        Loading…
      </p>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
