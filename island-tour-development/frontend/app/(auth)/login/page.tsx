import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Login - Island Tours",
  description: "Sign in to your account",
};

export default function LoginPage() {
  return (
    <AuthShell heading="Welcome">
      <LoginForm />
    </AuthShell>
  );
}
