import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import type { Role } from "../types";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { status, user } = useAuth();
  if (status === "loading") return <main className="centered"><span className="spinner" /> Loading your session…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
