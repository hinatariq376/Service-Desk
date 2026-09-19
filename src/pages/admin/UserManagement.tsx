import { useEffect, useState } from "react";
import {
  Search,
  Shield,
  Headphones,
  User,
  X,
  Eye,
  Check,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  UserCheck,
  UserX,
} from "lucide-react";
import { fetchAllUsers, approveAgent, denyAgent } from "../../services/userService";
import type { User as UserType, Role } from "../../types";

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  ADMIN: { label: "Administrator", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Shield },
  SUPPORT_AGENT: { label: "Support Agent", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: Headphones },
  CUSTOMER: { label: "Customer", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: User },
};

// ---------------------------------------------------------------------------
interface ProfileModalProps {
  user: UserType;
  onClose: () => void;
  onApprove?: (u: UserType) => void;
  onDeny?: (u: UserType) => void;
}

function UserProfileModal({ user, onClose, onApprove, onDeny }: ProfileModalProps) {
  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.CUSTOMER;
  const Icon = cfg.icon;
  const isAgent = user.role === "SUPPORT_AGENT" || (user.role as string)?.toUpperCase() === "SUPPORT_AGENT";
  const isApprovedAgent = isAgent && user.isApproved === true;
  const isDeniedAgent = isAgent && user.approvalStatus === "DENIED";
  const isPendingAgent = isAgent && !isApprovedAgent && !isDeniedAgent;

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
                  : isAgent
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
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </span>
                {isAgent && (
                  isDeniedAgent ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                      <UserX className="w-3 h-3 text-red-600" />
                      Status: Registration Denied
                    </span>
                  ) : isPendingAgent ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Status: Pending Approval
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Status: Approved / Active
                    </span>
                  )
                )}
                {!isAgent && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Status: Active
                  </span>
                )}
              </div>
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

          {/* Initial Action Buttons for Pending Unapproved Agents Only */}
          {isPendingAgent && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[11px] text-slate-500 font-medium">
                Decision Required: Support agents require administrator approval before gaining access to tickets.
              </p>
              <div className="flex gap-2">
                {onApprove && (
                  <button
                    type="button"
                    onClick={() => {
                      onApprove(user);
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    Approve Agent
                  </button>
                )}
                {onDeny && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeny(user);
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserX className="w-4 h-4 text-red-600" />
                    Deny Agent
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Close
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
type FilterTab = "ALL" | "APPROVED_AGENTS" | "UNAPPROVED_AGENTS" | "CUSTOMER" | "ADMIN";

export default function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [viewUser, setViewUser] = useState<UserType | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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

  const handleApprove = async (targetUser: UserType) => {
    setApprovingId(targetUser.id);
    setError("");
    setSuccessMsg("");
    try {
      const res = await approveAgent(targetUser.id);
      if (res.error) throw new Error(res.error);

      setSuccessMsg(`Support Agent "${targetUser.name}" has been permanently approved! They now have full access to tickets and queues.`);
      loadUsers();
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve agent.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeny = async (targetUser: UserType) => {
    setApprovingId(targetUser.id);
    setError("");
    setSuccessMsg("");
    try {
      const res = await denyAgent(targetUser.id);
      if (res.error) throw new Error(res.error);

      setSuccessMsg(`Support Agent "${targetUser.name}" registration has been rejected/denied.`);
      loadUsers();
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deny agent.");
    } finally {
      setApprovingId(null);
    }
  };

  const approvedAgents = users.filter(
    (u) => (u.role === "SUPPORT_AGENT" || (u.role as string)?.toUpperCase() === "SUPPORT_AGENT") && u.isApproved === true
  );
  const unapprovedAgents = users.filter(
    (u) => (u.role === "SUPPORT_AGENT" || (u.role as string)?.toUpperCase() === "SUPPORT_AGENT") && u.isApproved === false
  );
  const customers = users.filter((u) => u.role === "CUSTOMER" || (u.role as string)?.toUpperCase() === "CUSTOMER");
  const admins = users.filter((u) => u.role === "ADMIN" || (u.role as string)?.toUpperCase() === "ADMIN");

  const filtered = users.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      (u.name ?? "").toLowerCase().includes(searchLower) ||
      (u.email ?? "").toLowerCase().includes(searchLower);

    if (!matchSearch) return false;

    const isAgent = u.role === "SUPPORT_AGENT" || (u.role as string)?.toUpperCase() === "SUPPORT_AGENT";
    const isCustomer = u.role === "CUSTOMER" || (u.role as string)?.toUpperCase() === "CUSTOMER";
    const isAdmin = u.role === "ADMIN" || (u.role as string)?.toUpperCase() === "ADMIN";

    if (activeTab === "APPROVED_AGENTS") {
      return isAgent && u.isApproved === true;
    }
    if (activeTab === "UNAPPROVED_AGENTS") {
      return isAgent && u.isApproved === false;
    }
    if (activeTab === "CUSTOMER") {
      return isCustomer;
    }
    if (activeTab === "ADMIN") {
      return isAdmin;
    }
    return true; // ALL
  });

  return (
    <>
      {viewUser && (
        <UserProfileModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}

      <div className="space-y-5 max-w-7xl mx-auto w-full min-w-0">
        {/* Header - No manual agent registration button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">User Directory &amp; Role Access</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? "Loading users…" : `${users.length} total active team members & customers (agents register via public sign-up)`}
            </p>
          </div>
        </div>

        {/* Unapproved Agents Pending Banner */}
        {unapprovedAgents.length > 0 && activeTab !== "UNAPPROVED_AGENTS" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  {unapprovedAgents.length} Unapproved Support Agent{unapprovedAgents.length > 1 ? "s" : ""} Awaiting Review
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Unapproved agents cannot access tickets or queues until approved by an administrator.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("UNAPPROVED_AGENTS")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 transition-colors shrink-0 self-start sm:self-auto shadow-sm cursor-pointer"
            >
              View Unapproved Agents ({unapprovedAgents.length})
            </button>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 animate-fade-up">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}

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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
              <div
                onClick={() => setActiveTab("ALL")}
                className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
                  activeTab === "ALL" ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-slate-600 text-xs font-bold">
                  <User className="w-4 h-4 text-slate-600" />
                  <span>All Users</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">{users.length}</div>
              </div>

              <div
                onClick={() => setActiveTab("APPROVED_AGENTS")}
                className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
                  activeTab === "APPROVED_AGENTS" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-emerald-700 text-xs font-bold">
                  <Headphones className="w-4 h-4 text-emerald-600" />
                  <span>Approved Agents</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-700">{approvedAgents.length}</div>
              </div>

              <div
                onClick={() => setActiveTab("UNAPPROVED_AGENTS")}
                className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
                  activeTab === "UNAPPROVED_AGENTS" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-amber-700 text-xs font-bold">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Unapproved Agents</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-700">{unapprovedAgents.length}</div>
              </div>

              <div
                onClick={() => setActiveTab("CUSTOMER")}
                className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
                  activeTab === "CUSTOMER" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-blue-700 text-xs font-bold">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Customers</span>
                </div>
                <div className="text-2xl font-extrabold text-blue-700">{customers.length}</div>
              </div>
            </div>

            {/* Filters and Navigation Tabs */}
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

              {/* Distinct Tabs */}
              <div className="flex flex-wrap gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "ALL"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  All Users ({users.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("APPROVED_AGENTS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "APPROVED_AGENTS"
                      ? "bg-emerald-600 text-white shadow-sm font-bold"
                      : "text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Approved Agents</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "APPROVED_AGENTS" ? "bg-white text-emerald-800" : "bg-emerald-100 text-emerald-900"
                  }`}>
                    {approvedAgents.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("UNAPPROVED_AGENTS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "UNAPPROVED_AGENTS"
                      ? "bg-amber-600 text-white shadow-sm font-bold"
                      : "text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Unapproved Agents</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "UNAPPROVED_AGENTS" ? "bg-white text-amber-800" : "bg-amber-100 text-amber-900"
                  }`}>
                    {unapprovedAgents.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("CUSTOMER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "CUSTOMER"
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  Customers ({customers.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("ADMIN")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "ADMIN"
                      ? "bg-white text-purple-700 shadow-sm border border-slate-200 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  Admins ({admins.length})
                </button>
              </div>
            </div>

            {/* Users / Agents Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left min-w-[550px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Member Details", "Assigned Role", "Approval Status", "Actions"].map((h) => (
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
                      const isAgent = u.role === "SUPPORT_AGENT" || (u.role as string)?.toUpperCase() === "SUPPORT_AGENT";
                      const isApproved = isAgent && u.isApproved === true;
                      const isDenied = isAgent && u.approvalStatus === "DENIED";
                      const isPending = isAgent && !isApproved && !isDenied;

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50 transition-colors animate-fade-up ${
                            isPending ? "bg-amber-50/20" : ""
                          }`}
                          style={{ animationDelay: `${i * 20}ms` }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                  u.role === "ADMIN"
                                    ? "bg-purple-600"
                                    : isAgent
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
                            {isAgent ? (
                              isApproved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Status: Approved / Active
                                </span>
                              ) : isDenied ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">
                                  <UserX className="w-3 h-3 text-red-600" />
                                  Registration Denied
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Pending Approval
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* STRICT INITIAL ACTIONS: ONLY SHOW APPROVE & DENY ON PENDING UNAPPROVED AGENTS */}
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    disabled={approvingId === u.id}
                                    onClick={() => handleApprove(u)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
                                    title="Approve Support Agent permanently"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    {approvingId === u.id ? "Approving…" : "Approve"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={approvingId === u.id}
                                    onClick={() => handleDeny(u)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 active:scale-95 border border-red-200 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                                    title="Deny / Reject Support Agent Registration"
                                  >
                                    <X className="w-3.5 h-3.5 text-red-600" />
                                    {approvingId === u.id ? "Denying…" : "Deny"}
                                  </button>
                                </>
                              )}

                              {/* View Profile Action - Standard and clean for all users */}
                              <button
                                type="button"
                                onClick={() => setViewUser(u)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-3 py-1.5 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                title="View User Profile Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                View Profile
                              </button>
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
                  {activeTab === "UNAPPROVED_AGENTS"
                    ? "No unapproved agents. All support agent registrations have been approved."
                    : activeTab === "APPROVED_AGENTS"
                    ? "No approved agents found."
                    : users.length === 0
                    ? "No users found in database."
                    : "No users match the active filter or search."}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}