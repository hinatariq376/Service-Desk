import { useEffect, useState } from "react";
import { Search, Plus, MoreHorizontal, Shield, Headphones, User, Edit2 } from "lucide-react";
import { fetchAllUsers } from "../../services/userService";
import type { User as UserType, Role } from "../../types";

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  ADMIN: { label: "Administrator", color: "text-purple-400", bg: "bg-purple-950/40 border-purple-900", icon: Shield },
  SUPPORT_AGENT: { label: "Support Agent", color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-900", icon: Headphones },
  CUSTOMER: { label: "Customer", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-900", icon: User },
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAllUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "ALL" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-50">User Management</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading ? "Loading…" : `${users.length} total members across all roles`}
          </p>
        </div>
        <a
          href="/register"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition-all shadow-md shadow-indigo-900/30 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Invite Member
        </a>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {(["ADMIN", "SUPPORT_AGENT", "CUSTOMER"] as Role[]).map((r) => {
          const cfg = ROLE_CONFIG[r];
          const count = users.filter((u) => u.role === r).length;
          const Icon = cfg.icon;
          return (
            <div key={r} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className="text-xs font-semibold text-zinc-300">{cfg.label}s</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-zinc-50">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="relative flex-1 max-w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "ADMIN", "SUPPORT_AGENT", "CUSTOMER"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterRole === r ? "bg-indigo-600 text-white" : "text-zinc-400 border border-zinc-700 hover:border-zinc-600"
              }`}
            >
              {r === "ALL" ? "All" : r === "SUPPORT_AGENT" ? "Agents" : r === "ADMIN" ? "Admins" : "Customers"}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Member", "Role", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((u, i) => {
                const cfg = ROLE_CONFIG[u.role];
                const Icon = cfg.icon;
                return (
                  <tr key={u.id} className="hover:bg-zinc-800/20 transition-colors animate-fade-up" style={{ animationDelay: `${i * 25}ms` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            u.role === "ADMIN" ? "bg-purple-600" : u.role === "SUPPORT_AGENT" ? "bg-emerald-600" : "bg-blue-600"
                          }`}
                        >
                          {u.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-zinc-50 truncate">{u.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openMenu === u.id && (
                          <div className="absolute right-0 top-8 z-20 w-44 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-fade-up">
                            <button
                              type="button"
                              onClick={() => setOpenMenu(null)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
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
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-xs sm:text-sm text-zinc-500">No users match the current filters.</div>
        )}
      </div>
    </div>
  );
}