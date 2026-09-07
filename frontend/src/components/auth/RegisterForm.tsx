"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FlaskConical } from "lucide-react";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center py-12">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
          <FlaskConical className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">DataLab</h1>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Collect • Analyze • Build</p>
      </div>

      <div className="w-full bg-card border border-border p-8 rounded-2xl shadow-sm">
        <div className="space-y-1 mb-6 text-center sm:text-left">
          <h2 className="text-xl font-bold">Create an Account</h2>
          <p className="text-sm text-muted-foreground">Sign up to start your data journey.</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fullName">Full Name</label>
            <input 
              className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              id="fullName" placeholder="John Doe" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="email">Email address</label>
            <input 
              className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              id="email" placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input 
              className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              id="password" placeholder="Create a password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg">{error}</p>}
          <Button className="w-full h-11 text-base font-semibold rounded-lg mt-2" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a className="text-primary hover:underline font-medium" href="/login">Log In</a>
        </div>
      </div>
    </div>
  );
}
