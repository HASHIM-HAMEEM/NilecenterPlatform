import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { clearStoredSession, setStoredRole } from "@/lib/auth/session";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/backend/api";
import type { Role } from "@/lib/platformData";

const roleOptions: { label: string; value: Role }[] = [
  { label: "Student", value: "student" },
  { label: "Teacher", value: "teacher" },
  { label: "Registrar", value: "registrar" },
  { label: "HOD", value: "headofdepartment" },
  { label: "Branch Admin", value: "branchadmin" },
  { label: "Super Admin", value: "superadmin" },
];

export default function AuthFlowPage({ mode }: { mode: "forgot-password" | "reset-password" | "select-role" | "logout" }) {
  const currentSearch = typeof window === "undefined" ? "" : window.location.search;
  const query = useMemo(() => new URLSearchParams(currentSearch), [currentSearch]);
  const queryEmail = query.get("email") ?? "";
  const token = query.get("token") ?? "";
  const [email, setEmail] = useState(query.get("email") ?? "");
  const [role, setRole] = useState<Role>("student");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [demoResetPath, setDemoResetPath] = useState("");

  useEffect(() => {
    if (mode === "logout") clearStoredSession();
  }, [mode]);

  useEffect(() => {
    if (mode !== "reset-password") return;
    setEmail(queryEmail);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setError("");
  }, [mode, queryEmail, token]);

  const copy = {
    "forgot-password": {
      title: "Reset your password",
      description: "Enter your account email. Nile Learn will show the safe next step for demo accounts.",
      action: "Send reset link",
      icon: Mail,
    },
    "reset-password": {
      title: "Choose a new password",
      description: "Use the reset link from the request screen to update a demo password.",
      action: "Update password",
      icon: ShieldCheck,
    },
    "select-role": {
      title: "Select your role",
      description: "Users with multiple roles can choose the workspace they need for this session.",
      action: "Continue",
      icon: CheckCircle2,
    },
    logout: {
      title: "Signed out",
      description: "Your local demo session has ended.",
      action: "Return to login",
      icon: CheckCircle2,
    },
  }[mode];
  const quote = {
    "forgot-password": {
      arabic: "وَعَلَى اللَّهِ فَتَوَكَّلُوا",
      meaning: "Trust the process, then return with clarity.",
      source: "Qur'an 5:23",
    },
    "reset-password": {
      arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
      meaning: "With hardship comes ease.",
      source: "Qur'an 94:6",
    },
    "select-role": {
      arabic: "رَبِّ زِدْنِي عِلْمًا",
      meaning: "My Lord, increase me in knowledge.",
      source: "Qur'an 20:114",
    },
    logout: {
      arabic: "وَاللَّهُ خَيْرٌ حَافِظًا",
      meaning: "Allah is the best guardian.",
      source: "Qur'an 12:64",
    },
  }[mode];
  const Icon = copy.icon;

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setDemoResetPath("");
    if (!email.trim()) {
      setError("Enter the account email.");
      return;
    }
    setSubmitting(true);
    const response = await requestPasswordReset({ email, role });
    setSubmitting(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "Reset request failed.");
      return;
    }
    setMessage("If this account exists, reset instructions are ready.");
    setDemoResetPath(response.data.demoResetPath ?? "");
  };

  const confirmReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError("Open this page from a valid reset link.");
      return;
    }
    if (!email.trim()) {
      setError("Enter the account email.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const response = await confirmPasswordReset({ token, email, password });
    setSubmitting(false);
    if (!response.ok) {
      setError(response.error ?? "Password reset failed.");
      return;
    }
    setMessage("Password updated for this demo account. You can sign in now.");
  };

  return (
    <div className="auth-flow-page">
      <div className="auth-flow-card">
        <Link href="/auth/login" className="auth-back-link">
          <ArrowLeft size={15} />
          Login
        </Link>
        <span className="auth-flow-icon">
          <Icon size={22} />
        </span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="auth-flow-calligraphy" aria-label="Nile Learn inspiration">
          <span aria-hidden="true">
            <KeyRound size={15} />
          </span>
          <strong lang="ar" dir="rtl">{quote.arabic}</strong>
          <p>{quote.meaning}</p>
          <small>{quote.source}</small>
        </div>
        {mode === "select-role" ? (
          <div className="auth-role-list">
            {[
              ["Student", "student", "/app/student/dashboard"],
              ["Teacher", "teacher", "/app/teacher/dashboard"],
              ["Registrar", "registrar", "/app/registrar/dashboard"],
              ["HOD", "headofdepartment", "/app/hod/dashboard"],
              ["Branch Admin", "branchadmin", "/app/branch/dashboard"],
              ["Super Admin", "superadmin", "/app/admin/dashboard"],
            ].map(([label, role, href]) => (
              <Link key={label} href={href} onClick={() => setStoredRole(role as Role)}>
                {label}
              </Link>
            ))}
          </div>
        ) : mode === "logout" ? null : mode === "forgot-password" ? (
          <form onSubmit={requestReset}>
            <label className="auth-flow-field">
              Account email
              <input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </label>
            <label className="auth-flow-field">
              Workspace
              <select value={role} onChange={event => setRole(event.target.value as Role)}>
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="auth-flow-status error">{error}</p> : null}
            {message ? <p className="auth-flow-status success">{message}</p> : null}
            {demoResetPath ? (
              <Link href={demoResetPath} className="auth-submit-link secondary">
                Open demo reset link
              </Link>
            ) : null}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending" : copy.action}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmReset}>
            <label className="auth-flow-field">
              Account email
              <input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </label>
            <label className="auth-flow-field">
              New password
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </label>
            <label className="auth-flow-field">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
              />
            </label>
            {error ? <p className="auth-flow-status error">{error}</p> : null}
            {message ? <p className="auth-flow-status success">{message}</p> : null}
            {message ? (
              <Link href="/auth/login" className="auth-submit-link secondary">
                Return to login
              </Link>
            ) : null}
            <button type="submit" disabled={submitting}>
              {submitting ? "Updating" : copy.action}
            </button>
          </form>
        )}
        {mode === "logout" ? (
          <Link href="/auth/login" className="auth-submit-link">
            {copy.action}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
