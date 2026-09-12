import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Shield,
  Headphones,
  User,
  X,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Mail,
  Calendar,
} from "lucide-react";
import { fetchAllUsers, updateUserRole } from "../../services/userService";
import { useAuth } from "../../context/AuthContext";
import type { User as UserType, Role } from "../../types";

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  ADMIN: { label: "Administrator", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Shield },
  SUPPORT_AGENT: { label: "Support Agent", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: Headphones },
  CUSTOMER: { label: "Customer", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: User },
};

// ---------------------------------------------------------------------------
// Invite Agent Modal (BUG-3)
// ---------------------------------------------------------------------------
interface InviteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function InviteModal({ onClose, onSuccess }: InviteModalProps) {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("SUPPORT_AGENT");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Full name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setLoading(true);
    const result = await signUp({ name: name.trim(), email: email.trim(), password, role });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Invite New Member</h3>
            <p className="text-xs text-slate-500 mt-0.5">Create a new user account with a specific role</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["SUPPORT_AGENT", "CUSTOMER", "ADMIN"] as Role[]).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all border ${
                      role === r
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              Account created successfully!
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-md shadow-indigo-600/20"
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Profile Modal (BUG-5)
// ---------------------------------------------------------------------------
interface ProfileModalProps {
  user: UserType;
  onClose: () => void;
  onRoleChange: (userId: string, role: Role) => Promise<void>;
}

function UserProfileModal({ user, onClose, onRoleChange }: ProfileModalProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.CUSTOMER;
  const Icon = cfg.icon;

  const handleRoleChange = async () => {
    if (selectedRole === user.role) return;
    setSaving(true);
    setError("");
    try {
      await onRoleChange(user.id, selectedRole);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">User Profile</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md ${
                user.role === "ADMIN"
                  ? "bg-purple-600"
                  : user.role === "SUPPORT_AGENT"
                  ? "bg-emerald-600"
                  : "bg-blue-600"
              }`}
            >
              {(user.name ?? "")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "?"}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">{user.name || "Unknown"}</div>
              <span
                className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.color}`}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium">{user.email || "No email"}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium">ID: <span className="font-mono text-indigo-600">{user.id.slice(0, 8)}…</span></span>
            </div>
          </div>

          {/* Role change */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Change Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["SUPPORT_AGENT", "CUSTOMER", "ADMIN"] as Role[]).map((r) => {
                const rcfg = ROLE_CONFIG[r];
                const RIcon = rcfg.icon;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRole(r)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-all border ${
                      selectedRole === r
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <RIcon className="w-3.5 h-3.5" />
                    {rcfg.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              Role updated successfully!
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRoleChange}
              disabled={saving || saved || selectedRole === user.role}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving…" : "Update Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main UserManagement component
// ---------------------------------------------------------------------------
export default function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [viewUser, setViewUser] = useState<UserType | null>(null);

  const loadUsers = () => {
    fetchAllUsers()
      .then((data) => {
        setUsers(data || []);
        setError("");
      })
      .catch((err) => {
        console.error("Failed to fetch users:", err);
        setError(err instanceof Error ? err.message : "Failed to load users.");
        setUsers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, role: Role) => {
    await updateUserRole(userId, role);
    // Refresh list
    const updated = await fetchAllUsers().catch(() => users);
    setUsers(updated);
  };

  const filtered = users.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      (u.name ?? "").toLowerCase().includes(searchLower) ||
      (u.email ?? "").toLowerCase().includes(searchLower);
    const matchRole = filterRole === "ALL" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <>
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setLoading(true);
            loadUsers();
          }}
        />
      )}
      {viewUser && (
        <UserProfileModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onRoleChange={handleRoleChange}
        />
      )}

      <div className="space-y-5 max-w-7xl mx-auto w-full min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">User Directory &amp; Role Access</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? "Loading users…" : `${users.length} total active team members & customers`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3.5 py-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Invite / Register Member
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 animate-fade-up">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center animate-fade-up shadow-sm">
            <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-slate-500">Loading user directory…</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Role Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
              {(["ADMIN", "SUPPORT_AGENT", "CUSTOMER"] as Role[]).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const count = users.filter((u) => u.role === r).length;
                const Icon = cfg.icon;
                return (
                  <div key={r} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                      <span className="text-xs font-bold text-slate-700">{cfg.label}s</span>
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900">{count}</div>
                  </div>
                );
              })}
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
              <div className="relative flex-1 max-w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["ALL", "ADMIN", "SUPPORT_AGENT", "CUSTOMER"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFilterRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterRole === r
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {r === "ALL" ? "All Users" : r === "SUPPORT_AGENT" ? "Agents" : r === "ADMIN" ? "Admins" : "Customers"}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Member Details", "Assigned Role", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((u, i) => {
                      const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.CUSTOMER;
                      const Icon = cfg.icon;
                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50 transition-colors animate-fade-up"
                          style={{ animationDelay: `${i * 20}ms` }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                  u.role === "ADMIN"
                                    ? "bg-purple-600"
                                    : u.role === "SUPPORT_AGENT"
                                    ? "bg-emerald-600"
                                    : "bg-blue-600"
                                }`}
                              >
                                {(u.name ?? "")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">{u.name || "Unknown"}</div>
                                <div className="text-xs text-slate-500 truncate font-medium">{u.email || ""}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${cfg.bg} ${cfg.color}`}
                            >
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {openMenu === u.id && (
                                <div className="absolute right-0 top-9 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-up">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewUser(u);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                    View Profile
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-xs sm:text-sm text-slate-500">
                  {users.length === 0 ? "No users found in database." : "No users match the active filter."}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}