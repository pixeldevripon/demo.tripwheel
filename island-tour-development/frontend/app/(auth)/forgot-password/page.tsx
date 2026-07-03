import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Forgot Password - Island Tours",
  description: "Reset your Island Tours password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell heading="Recover">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
