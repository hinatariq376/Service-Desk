import { useState } from "react";
import { Shield, Eye, EyeOff, Headphones, User, Settings } from "lucide-react";
import type { Role } from "../types";

interface LoginScreenProps {
  onLogin: (role: Role) => void;
}

const ROLE_CONFIG = [
  { role: "CUSTOMER" as Role, label: "Customer", icon: User, desc: "Submit & track requests" },
  { role: "SUPPORT_AGENT" as Role, label: "Support Agent", icon: Headphones, desc: "Manage ticket queue" },
  { role: "ADMIN" as Role, label: "Admin", icon: Settings, desc: "Analytics & management" },
];

const DEMO_CREDS: Record<Role, { email: string; password: string }> = {
  CUSTOMER: { email: "hina@example.com", password: "customer123" },
  SUPPORT_AGENT: { email: "alex@support.com", password: "agent123" },
  ADMIN: { email: "omar@admin.com", password: "admin123" },
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [email, setEmail] = useState(DEMO_CREDS.CUSTOMER.email);
  const [password, setPassword] = useState(DEMO_CREDS.CUSTOMER.password);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleChange = (r: Role) => {
    setRole(r);
    setEmail(DEMO_CREDS[r].email);
    setPassword(DEMO_CREDS[r].password);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your credentials.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(role);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-800/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, #6366f1 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="w-full max-w-md relative animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Service Desk Platform</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account to continue</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-slate-800/60 rounded-xl">
            {ROLE_CONFIG.map(({ role: r, label, icon: Icon }) => (
              <button
                key={r}
                onClick={() => handleRoleChange(r)}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                  role === r
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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

          <div className="mt-5 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center mb-3">Demo credentials (pre-filled)</p>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {ROLE_CONFIG.map(({ role: r, label, desc }) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`rounded-lg p-2 border transition-all text-left ${
                    role === r
                      ? "border-indigo-700 bg-indigo-950/60"
                      : "border-slate-800 bg-slate-800/30 hover:border-slate-700"
                  }`}
                >
                  <div className={`text-xs font-semibold ${role === r ? "text-indigo-300" : "text-slate-300"}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
