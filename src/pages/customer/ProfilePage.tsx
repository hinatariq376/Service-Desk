import { useState } from "react";
import { Save, Shield, Bell, Key, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import type { User } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { updatePassword, updateUserDisplayName } from "../../services/userService";

interface ProfilePageProps {
  user: User;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSLA, setNotifSLA] = useState(true);
  const [notifStatus, setNotifStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState<"idle" | "success" | "error">("idle");
  const [pwMessage, setPwMessage] = useState("");

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setSaveStatus("error");
      setSaveMessage("Name cannot be empty.");
      return;
    }
    setSaving(true);
    setSaveStatus("idle");
    const result = await updateUserDisplayName(user.id, name.trim());
    setSaving(false);
    if (result.error) {
      setSaveStatus("error");
      setSaveMessage(result.error);
    } else {
      setSaveStatus("success");
      setSaveMessage("Profile updated successfully.");
      await refreshProfile();
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleChangePassword = async () => {
    if (!newPw) {
      setPwStatus("error");
      setPwMessage("Please enter a new password.");
      return;
    }
    if (newPw.length < 8) {
      setPwStatus("error");
      setPwMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmNewPw) {
      setPwStatus("error");
      setPwMessage("New passwords do not match.");
      return;
    }
    setPwSaving(true);
    setPwStatus("idle");
    const result = await updatePassword(newPw);
    setPwSaving(false);
    if (result.error) {
      setPwStatus("error");
      setPwMessage(result.error);
    } else {
      setPwStatus("success");
      setPwMessage("Password changed successfully. You can use the new password next time you sign in.");
      setNewPw("");
      setConfirmNewPw("");
      setTimeout(() => setPwStatus("idle"), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full min-w-0">
      <div className="animate-fade-up">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account &amp; Profile Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage your identity and notification preferences</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-md shadow-indigo-600/20">
          {user.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
        </div>
        <div>
          <div className="text-base font-bold text-slate-900">{user.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
            <Shield className="w-3 h-3" />
            {user.role.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm animate-fade-up" style={{ animationDelay: "80ms" }}>
        <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <input
            value={user.email}
            readOnly
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-400 mt-1">Email is managed by your authentication provider.</p>
        </div>

        {saveStatus === "success" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            {saveMessage}
          </div>
        )}
        {saveStatus === "error" && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {saveMessage}
          </div>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all shadow-md shadow-indigo-600/20"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Notification Preferences</h3>
        </div>
        {[
          { label: "Email Notifications", desc: "Receive ticket resolution alerts via email", state: notifEmail, set: setNotifEmail },
          { label: "SLA Warning Alerts", desc: "Alert when SLA deadline is approaching under 30 minutes", state: notifSLA, set: setNotifSLA },
          { label: "Status Change Updates", desc: "Real-time updates on every status transition", state: notifStatus, set: setNotifStatus },
        ].map(({ label, desc, state, set }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <div>
              <div className="text-sm font-medium text-slate-800">{label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
            </div>
            <button
              onClick={() => set(!state)}
              className={`relative w-10 h-6 rounded-full transition-colors ${state ? "bg-indigo-600" : "bg-slate-300"}`}
              aria-label={label}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${state ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Password Change */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                placeholder="Min 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPw ? "text" : "password"}
              value={confirmNewPw}
              onChange={(e) => setConfirmNewPw(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        {pwStatus === "success" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            {pwMessage}
          </div>
        )}
        {pwStatus === "error" && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {pwMessage}
          </div>
        )}

        <button
          onClick={handleChangePassword}
          disabled={pwSaving || !newPw}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all"
        >
          <Key className="w-3.5 h-3.5" />
          {pwSaving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </div>
  );
}
