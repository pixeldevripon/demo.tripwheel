import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Sign Up - Island Tours",
  description: "Create a new account",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <SignupForm />
    </div>
  );
}
