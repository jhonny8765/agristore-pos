"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/api";
import { Button } from "./ui/button";
import { StoreBrand } from "./store-brand";

type PasswordRecoveryProps = {
  mode: "request" | "update";
  onBack: () => void | Promise<void>;
  onComplete: () => void;
};

export function PasswordRecovery({ mode, onBack, onComplete }: PasswordRecoveryProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode !== "update") return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) setSessionReady(!error && !!data.session);
    }).catch(() => {
      if (active) setSessionReady(false);
    });
    return () => { active = false; };
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "request") {
        const redirectTo = new URL("/", window.location.origin);
        redirectTo.searchParams.set("password-recovery", "1");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectTo.toString(),
        });
        if (error) throw error;
        // Keep the same response whether or not the email belongs to a user.
        setMessage("If this email belongs to an account, a password-reset link will arrive shortly. Check your inbox and spam folder.");
      } else {
        if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
        if (password !== confirmation) throw new Error("The passwords do not match.");
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw new Error("This recovery link has expired. Request another password-reset email.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut();
        onComplete();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The request could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="password-recovery-page">
      <div className="password-recovery-card">
        <div className="password-recovery-brand"><StoreBrand /></div>
        <span className="password-recovery-kicker"><ShieldCheck size={17} aria-hidden="true" /> Account access</span>
        <h1>{mode === "request" ? "Reset your password." : "Choose a new password."}</h1>
        <p>{mode === "request"
          ? "Enter your account email. We'll send you a secure recovery link."
          : "After setting a new password, sign in again to access your assigned store."}</p>
        {error && <p role="alert" className="notice error">{error}</p>}
        {message && <p role="status" className="notice success">{message}</p>}
        {mode === "update" && sessionReady === false && (
          <p role="alert" className="notice error">This link could not be verified. Request a new reset email from the sign-in page.</p>
        )}
        <form onSubmit={(event) => void submit(event)}>
          {mode === "request" ? (
            <label className="field"><span>Email address</span><div className="auth-input-wrap"><Mail size={19} aria-hidden="true" /><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
          ) : (
            <>
              <label className="field"><span>New password</span><div className="auth-input-wrap"><LockKeyhole size={19} aria-hidden="true" /><input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div></label>
              <label className="field"><span>Confirm new password</span><div className="auth-input-wrap"><LockKeyhole size={19} aria-hidden="true" /><input type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter the new password again" /></div></label>
            </>
          )}
          <Button type="submit" disabled={busy || (mode === "update" && sessionReady === false)}>
            {busy ? "Please wait…" : mode === "request" ? "Send recovery link" : "Update password"} <ArrowRight size={18} />
          </Button>
        </form>
        <button type="button" className="text-button password-recovery-back" onClick={() => void onBack()}>
          <ArrowLeft size={17} /> Back to sign in
        </button>
        <p className="password-recovery-note">Your saved local sales and recovery records are not deleted by requesting a password reset.</p>
      </div>
    </main>
  );
}
