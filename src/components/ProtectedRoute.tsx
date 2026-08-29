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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-slate-500 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    const fallback =
      user.role === "CUSTOMER"
        ? "/customer/dashboard"
        : user.role === "SUPPORT_AGENT"
          ? "/agent/queue"
          : "/admin/analytics";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

export function RoleRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "CUSTOMER") return <Navigate to="/customer/dashboard" replace />;
  if (user.role === "SUPPORT_AGENT") return <Navigate to="/agent/queue" replace />;
  return <Navigate to="/admin/analytics" replace />;
}
