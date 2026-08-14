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
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="animate-fade-up">
        <h2 className="text-lg font-bold text-white">Profile Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage your account and notification preferences</p>
      </div>

      {/* Avatar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
          {user.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div>
          <div className="text-base font-bold text-white">{user.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900 px-2 py-0.5 rounded">
            <Shield className="w-2.5 h-2.5" />
            Customer
          </span>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <h3 className="text-sm font-semibold text-white">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Organization</label>
          <input value="Hina Tariq Organization" readOnly className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed" />
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
        </div>
        {[
          { label: "Email Notifications", desc: "Receive ticket updates via email", state: notifEmail, set: setNotifEmail },
          { label: "SLA Warning Alerts", desc: "Alert when SLA deadline is approaching", state: notifSLA, set: setNotifSLA },
          { label: "Status Change Updates", desc: "Notify on every ticket status change", state: notifStatus, set: setNotifStatus },
        ].map(({ label, desc, state, set }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
            <div>
              <div className="text-sm text-slate-200">{label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
            </div>
            <button
              onClick={() => set(!state)}
              className={`relative w-9 h-5 rounded-full transition-colors ${state ? "bg-indigo-600" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${state ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Password */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-white">Change Password</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Current Password", value: currentPw, onChange: setCurrentPw },
            { label: "New Password", value: newPw, onChange: setNewPw },
          ].map(({ label, value, onChange }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all animate-fade-up flex items-center justify-center gap-2 ${
          saved ? "bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30"
        }`}
        style={{ animationDelay: "200ms" }}
      >
        <Save className="w-4 h-4" />
        {saved ? "Changes Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
