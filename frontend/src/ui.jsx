export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    ghost: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2
        text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50
        ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ label, error, className = "", ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <input
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition
          focus:ring-2 focus:ring-indigo-500/30
          ${error ? "border-red-400" : "border-slate-300 focus:border-indigo-500"}
          ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-slate-300
        border-t-indigo-600 ${className}`}
    />
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <textarea
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none
          transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ${className}`}
        {...props}
      />
    </label>
  );
}