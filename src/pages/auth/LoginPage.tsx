import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Headphones, User, Settings } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types";
import { DEMO_EMAILS, DEMO_PASSWORD } from "../../types";

const ROLE_CONFIG = [
  { role: "CUSTOMER" as Role, label: "Customer", icon: User, desc: "Submit & track requests" },
  { role: "SUPPORT_AGENT" as Role, label: "Support Agent", icon: Headphones, desc: "Manage assigned tickets" },
  { role: "ADMIN" as Role, label: "Admin", icon: Settings, desc: "Analytics & management" },
];

export default function LoginPage() {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Role>(() => {
    const saved = sessionStorage.getItem("service_desk_active_tab") as Role;
    return saved && ["CUSTOMER", "SUPPORT_AGENT", "ADMIN"].includes(saved) ? saved : "ADMIN";
  });

  const [email, setEmail] = useState(() => {
    const saved = sessionStorage.getItem("service_desk_active_tab") as Role;
    const initialRole = saved && ["CUSTOMER", "SUPPORT_AGENT", "ADMIN"].includes(saved) ? saved : "ADMIN";
    return DEMO_EMAILS[initialRole] || DEMO_EMAILS.ADMIN;
  });

  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTabClick = (r: Role) => {
    setActiveTab(r);
    sessionStorage.setItem("service_desk_active_tab", r);
    setEmail(DEMO_EMAILS[r]);
    setPassword(DEMO_PASSWORD);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);

    try {
      // 1. Call signIn from AuthContext which sets session & loads profile synchronously
      const result = await signIn(email.trim(), password);

      if (result.error) {
        setLoading(false);
        setError(result.error);
        return;
      }

      // 2. Resolve role from loaded profile or fallback
      let targetRole = (result.user?.role || activeTab).toUpperCase();

      // Additional verify from public.users if available
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: userProfile } = await supabase
            .from("users")
            .select("role")
            .eq("id", authData.user.id)
            .maybeSingle();

          if (userProfile?.role) {
            targetRole = userProfile.role.toUpperCase();
          } else if (authData.user.user_metadata?.role) {
            targetRole = authData.user.user_metadata.role.toUpperCase();
          }
        }
      } catch (_) {}

      setLoading(false);

      if (targetRole === "ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else if (targetRole === "SUPPORT_AGENT") {
        navigate("/agent/dashboard", { replace: true });
      } else {
        navigate("/customer/dashboard", { replace: true });
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    }
  };

  // If session is already active and verified, navigate immediately
  useEffect(() => {
    if (user && !authLoading) {
      const userRole = (user.role || "").toUpperCase();
      if (userRole === "ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else if (userRole === "SUPPORT_AGENT") {
        navigate("/agent/dashboard", { replace: true });
      } else {
        navigate("/customer/dashboard", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  if (user && !authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-800/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Desk Platform</h1>
          <p className="text-slate-600 text-sm mt-1">Sign in to your account to continue</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
          {/* Active Tab Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
            {ROLE_CONFIG.map(({ role: r, label, icon: Icon }) => (
              <button
                key={r}
                type="button"
                onClick={() => handleTabClick(r)}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === r
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@servicedesk.com"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 animate-fade-up">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition-all duration-200 shadow-md shadow-indigo-600/20 mt-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-600 text-center mb-3">
              Demo credentials (pre-filled) · password: <span className="font-mono text-slate-700">{DEMO_PASSWORD}</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {ROLE_CONFIG.map(({ role: r, label }) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleTabClick(r)}
                  className={`rounded-lg p-2 border transition-all text-left cursor-pointer ${
                    activeTab === r
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className={`text-xs font-semibold ${activeTab === r ? "text-indigo-700" : "text-slate-700"}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5 truncate">{DEMO_EMAILS[r]}</div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600 text-center mt-4">
            No account?{" "}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}