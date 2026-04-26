import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Forgot Password - Island Tours",
  description: "Reset your Island Tours password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <ForgotPasswordForm />
    </div>
  );
}
