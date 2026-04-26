"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel, FieldError } from "@/components/ui/field";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await signUp.email({
        name,
        email,
        password,
        callbackURL: `${window.location.origin}/dashboard`,
      });

      if (authError) {
        setError(authError.message || "Failed to sign up");
      } else {
        // Email verification is required — show confirmation instead of redirecting
        setVerificationSent(true);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification link to <strong>{email}</strong>.
            Click the link to activate your account, then sign in.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <a href="/login" className="text-sm underline hover:text-primary">
            Go to sign in
          </a>
        </CardFooter>
      </Card>
    );
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign Up</CardTitle>
        <CardDescription>Create a new account to get started.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                aria-invalid={!!error}
              />
            </Field>

            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                aria-invalid={!!error}
              />
            </Field>

            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={!!error}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading || isGoogleLoading}>
            {loading ? "Signing up..." : "Sign Up"}
          </Button>

          <div className="relative w-full text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>

          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={handleGoogleSignIn}
            disabled={loading || isGoogleLoading}
          >
            {isGoogleLoading ? "Connecting..." : "Sign up with Google"}
          </Button>

          <div className="text-sm text-center text-muted-foreground mt-2">
            Already have an account? <a href="/login" className="underline hover:text-primary">Sign in</a>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
