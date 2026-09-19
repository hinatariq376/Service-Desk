import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Never redirect or bounce during loading/initialization
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-slate-500 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Verifying session & permissions…</p>
        </div>
      </div>
    );
  }

  // 2. If unauthenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 3. Case-insensitive role check
  const userRole = (user.role || "").toUpperCase();
  if (roles && roles.length > 0) {
    const normalizedAllowedRoles = roles.map((r) => r.toUpperCase());
    if (!normalizedAllowedRoles.includes(userRole)) {
      const fallback =
        userRole === "CUSTOMER"
          ? "/customer/dashboard"
          : userRole === "SUPPORT_AGENT"
            ? "/agent/dashboard"
            : "/admin/dashboard";
      return <Navigate to={fallback} replace />;
    }
  }

  return <>{children}</>;
}

export function RoleRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-slate-500 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const userRole = (user.role || "").toUpperCase();
  if (userRole === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (userRole === "SUPPORT_AGENT") return <Navigate to="/agent/dashboard" replace />;
  return <Navigate to="/customer/dashboard" replace />;
}
