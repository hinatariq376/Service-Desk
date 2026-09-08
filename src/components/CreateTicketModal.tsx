import { useState } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import type { Priority } from "../types";

interface CreateTicketModalProps {
  onClose: () => void;
  onSubmit: (ticket: {
    title: string;
    description: string;
    category: string;
    priority: Priority;
    attachments?: string[];
  }) => Promise<void>;
}

const CATEGORIES = [
  "Infrastructure",
  "Authentication",
  "UI Bug",
  "Data Export",
  "Billing",
  "Integrations",
  "Feature Request",
  "Other",
];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100",
  HIGH: "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100",
  CRITICAL: "bg-red-50 text-red-700 border-red-300 hover:bg-red-100",
};

const PRIORITY_ACTIVE_STYLES: Record<Priority, string> = {
  LOW: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
  MEDIUM: "bg-amber-500 text-slate-900 border-amber-500 shadow-sm",
  HIGH: "bg-orange-600 text-white border-orange-600 shadow-sm",
  CRITICAL: "bg-red-600 text-white border-red-600 shadow-sm",
};

function validate(fields: { title: string; category: string; description: string }) {
  const errors: Record<string, string> = {};
  if (!fields.title.trim()) errors.title = "Title is required";
  else if (fields.title.trim().length < 5) errors.title = "Title must be at least 5 characters";
  if (!fields.category) errors.category = "Please select a category";
  if (!fields.description.trim()) errors.description = "Description is required";
  else if (fields.description.trim().length < 10) errors.description = "Description must be at least 10 characters";
  return errors;
}

export default function CreateTicketModal({ onClose, onSubmit }: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate({ title, category, description });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), category, priority, description: description.trim(), attachments: files });
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Failed to create ticket." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).map((f) => f.name);
    setFiles((prev) => [...prev, ...dropped]);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Create New Service Request</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill in details to submit ticket to support queue</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((p) => ({ ...p, title: "" }));
              }}
              placeholder="Brief description of the issue…"
              className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                errors.title ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
              }`}
            />
            {errors.title && (
              <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setErrors((p) => ({ ...p, category: "" }));
                }}
                className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                  errors.category ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
                }`}
              >
                <option value="" className="text-slate-400">
                  Select category…
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="text-slate-900">
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      priority === p ? PRIORITY_ACTIVE_STYLES[p] : PRIORITY_STYLES[p]
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((p) => ({ ...p, description: "" }));
              }}
              placeholder="Provide detailed steps to reproduce, impact, and error messages…"
              rows={4}
              className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none ${
                errors.description ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
              }`}
            />
            {errors.description && (
              <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.description}
              </p>
            )}
            <div className="text-right text-[10px] text-slate-500 mt-0.5">{description.length} characters</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Attachments (Optional)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                dragOver ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <Upload className="w-5 h-5 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-700 font-medium">
                Drag and drop files here or{" "}
                <label className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer underline">
                  browse
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      setFiles((prev) => [...prev, ...Array.from(e.target.files || []).map((f) => f.name)])
                    }
                  />
                </label>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, PDF, CSV, LOG — up to 10MB</p>
            </div>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-lg border border-slate-300"
                  >
                    {f}
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {errors.form && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errors.form}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-60 shadow-md shadow-indigo-600/20"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
