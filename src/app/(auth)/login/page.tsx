"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width="80" height="80" className="w-20 h-20 rounded-xl mx-auto mb-4 object-cover" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          HOPE COFFEE
        </h1>
        <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
          Grupo Orion — Coffee Export Management
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 dark:border-orion-700 rounded-md bg-white dark:bg-orion-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orion-400 focus:border-orion-400 outline-none"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-slate-300 dark:border-orion-700 rounded-md bg-white dark:bg-orion-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orion-400 focus:border-orion-400 outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-orion-600 hover:bg-orion-700 disabled:bg-orion-400 dark:bg-orion-500 dark:hover:bg-orion-600 text-white font-medium rounded-md transition-colors"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
