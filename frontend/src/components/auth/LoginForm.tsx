"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { FlaskConical } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Use full page navigation so browser sends the new session cookie with the request
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") || "/dashboard";
      window.location.href = redirect;
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
          <FlaskConical className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">DataLab</h1>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Collect • Analyze • Build</p>
      </div>

      <div className="w-full bg-card border border-border p-8 rounded-2xl shadow-sm">
        <div className="space-y-1 mb-6 text-center sm:text-left">
          <h2 className="text-xl font-bold">Welcome Back</h2>
          <p className="text-sm text-muted-foreground">Sign in to continue to your data journey.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="email">Email address</label>
            <input 
              className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              id="email" placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required 
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
            </div>
            <input 
              className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              id="password" placeholder="Enter your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required 
            />
          </div>
          <div className="flex items-center justify-between text-sm pb-2">
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
              <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
              Remember me
            </label>
            <a href="#" className="text-primary hover:underline font-medium">Forgot password?</a>
          </div>
          {error && <p className="text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg">{error}</p>}
          <Button className="w-full h-11 text-base font-semibold rounded-lg" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>
        
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <Button variant="outline" className="h-11 rounded-lg">Google</Button>
            <Button variant="outline" className="h-11 rounded-lg">GitHub</Button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a className="text-primary hover:underline font-medium" href="/register">Sign up</a>
        </div>
      </div>
    </div>
  );
}
