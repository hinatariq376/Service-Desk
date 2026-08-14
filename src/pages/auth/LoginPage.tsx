import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Headphones, User, Settings } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types";
import { DEMO_EMAILS, DEMO_PASSWORD } from "../../types";

const ROLE_CONFIG = [
  { role: "CUSTOMER" as Role, label: "Customer", icon: User, desc: "Submit & track requests" },
  { role: "SUPPORT_AGENT" as Role, label: "Support Agent", icon: Headphones, desc: "Manage assigned tickets" },
  { role: "ADMIN" as Role, label: "Admin", icon: Settings, desc: "Analytics & management" },
];

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [email, setEmail] = useState(DEMO_EMAILS.CUSTOMER);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Helper function to handle exact dashboard routing by role
 const routeUserByRole = (targetRole?: string | Role) => {
    const roleStr = String(targetRole || "").toUpperCase();
    
    if (roleStr.includes("AGENT")) {
      navigate("/agent/dashboard");
    } else if (roleStr.includes("ADMIN")) {
      navigate("/admin/dashboard");
    } else {
      navigate("/customer/dashboard");
    }
  };

  const handleRoleChange = (r: Role) => {
    setRole(r);
    setEmail(DEMO_EMAILS[r]);
    setPassword(DEMO_PASSWORD);
    setError("");
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your credentials.");
      return;
    }
    setLoading(true);

    const selectedRole = role;

    const result = await signIn(email, password);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    const userRole = result?.user?.role || user?.role || selectedRole;
    routeUserByRole(userRole);
  };

useEffect(() => {
    if (user) {
      routeUserByRole(user.role || role);
    }
  }, [user]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-800/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Service Desk Platform</h1>
          <p className="text-zinc-400 text-sm mt-1">Sign in to your account to continue</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-zinc-800/60 rounded-xl">
            {ROLE_CONFIG.map(({ role: r, label, icon: Icon }) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                  role === r
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@servicedesk.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition-all duration-200 shadow-lg shadow-indigo-900/30 mt-2"
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

          <div className="mt-5 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 text-center mb-3">
              Demo credentials (pre-filled) · password: <span className="font-mono text-zinc-400">{DEMO_PASSWORD}</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {ROLE_CONFIG.map(({ role: r, label }) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`rounded-lg p-2 border transition-all text-left ${
                    role === r
                      ? "border-indigo-700 bg-indigo-950/60"
                      : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-700"
                  }`}
                >
                  <div className={`text-xs font-semibold ${role === r ? "text-indigo-300" : "text-zinc-300"}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{DEMO_EMAILS[r]}</div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-500 text-center mt-4">
            No account?{" "}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}