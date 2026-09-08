import { useState } from "react";
import { Save, Shield, Bell, Key, Eye, EyeOff } from "lucide-react";
import type { User } from "../../types";

interface ProfilePageProps {
  user: User;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSLA, setNotifSLA] = useState(true);
  const [notifStatus, setNotifStatus] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full min-w-0">
      <div className="animate-fade-up">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account & Profile Settings</h2>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>
        </div>
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
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${state ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Password */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Security Credentials</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Current Password", value: currentPw, onChange: setCurrentPw },
            { label: "New Password", value: newPw, onChange: setNewPw },
          ].map(({ label, value, onChange }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                  placeholder="••••••••"
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
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md animate-fade-up flex items-center justify-center gap-2 ${
          saved ? "bg-emerald-600 text-white shadow-emerald-600/20" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
        }`}
        style={{ animationDelay: "200ms" }}
      >
        <Save className="w-4 h-4" />
        {saved ? "Changes Saved!" : "Save Profile Changes"}
      </button>
    </div>
  );
}
