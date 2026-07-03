import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Suspense } from "react";

export const metadata = {
  title: "Reset Password - Island Tours",
  description: "Choose a new password for your Island Tours account",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell heading="Reset">
      {/* Suspense required because ResetPasswordForm uses useSearchParams() */}
      <Suspense
        fallback={<div className="text-sm text-slate-500">Loading...</div>}
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
