import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Login - Island Tours",
  description: "Sign in to your account",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
