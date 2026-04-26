import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = {
  title: "Reset Password - Island Tours",
  description: "Choose a new password for your Island Tours account",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* Suspense required because ResetPasswordForm uses useSearchParams() */}
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
