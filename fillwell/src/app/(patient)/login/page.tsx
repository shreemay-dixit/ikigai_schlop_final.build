"use client";

import React, { useState } from "react";
import { Loader2, Mail, Lock, AlertCircle, ArrowRight, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type View = "login" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Please enter a valid email address.";
    }
    if (view !== "forgot" && (!password || password.length < 6)) {
      e.password = "Password must be at least 6 characters.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsLoading(false);

    if (view === "forgot") {
      toast.success("Reset link sent", { description: `Check your inbox at ${email}` });
      setView("login");
    } else {
      toast.success("Welcome back!", { description: "Redirecting to dashboard…" });
      router.push("/dashboard");
    }
  };

  const inputClass = (field: string) =>
    `block w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all placeholder:text-stone-400 ${
      errors[field]
        ? "border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200"
        : "border-stone-200 bg-white text-stone-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm space-y-8 animate-page-in">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md">
            <HeartPulse className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {view === "login" && "Sign in to Fillwell"}
            {view === "signup" && "Create your account"}
            {view === "forgot" && "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {view === "login" && (
              <>No account?{" "}<button onClick={() => { setView("signup"); setErrors({}); }} className="font-medium text-rose-600 hover:text-rose-500">Sign up</button></>
            )}
            {view === "signup" && (
              <>Already registered?{" "}<button onClick={() => { setView("login"); setErrors({}); }} className="font-medium text-rose-600 hover:text-rose-500">Sign in</button></>
            )}
            {view === "forgot" && (
              <>Remember it?{" "}<button onClick={() => { setView("login"); setErrors({}); }} className="font-medium text-rose-600 hover:text-rose-500">Back to sign in</button></>
            )}
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const { email, ...rest } = p; return rest; }); }}
                className={`${inputClass("email")} pl-9`}
                placeholder="you@clinic.com"
              />
            </div>
            {errors.email && <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
          </div>

          {/* Password */}
          {view !== "forgot" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">Password</label>
                {view === "login" && (
                  <button type="button" onClick={() => { setView("forgot"); setErrors({}); }} className="text-xs font-medium text-rose-600 hover:text-rose-500">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => { const { password, ...rest } = p; return rest; }); }}
                  className={`${inputClass("password")} pl-9`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />{errors.password}</p>}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
            ) : (
              <>{view === "login" ? "Sign in" : view === "signup" ? "Create account" : "Send reset link"}<ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          {view === "login" && (
            <button
              type="button"
              onClick={() => {
                setEmail("admin@fillwell.com");
                setPassword("fillwell123");
                setErrors({});
              }}
              className="w-full text-center text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 rounded-lg py-2 transition"
            >
              ⚡ Fill Demo Credentials (admin@fillwell.com)
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
