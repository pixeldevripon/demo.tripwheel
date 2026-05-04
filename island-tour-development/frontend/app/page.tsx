import Link from "next/link";
import { UserPlus, Building2, Globe } from "lucide-react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-primary/10">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        {/* Header Section */}
        <div className="max-w-2xl w-full text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-sm">
               <Globe className="text-primary-foreground w-6 h-6" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Welcome to Island Tours
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Choose your account type to get started with our platform.
          </p>
        </div>

        {/* Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* User Sign Up Card */}
          <Card className="flex flex-col border border-border bg-card shadow-sm hover:border-primary/40 transition-colors">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <UserPlus className="w-5 h-5" />
                </div>
                <CardTitle className="normal-case tracking-normal text-xl">Sign Up as User</CardTitle>
              </div>
              <CardDescription className="text-base">
                Find and book the most beautiful island tours around the globe.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span>Browse thousands of curated tours</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span>Secure booking & payment system</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span>Manage your trips and favorites</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button asChild className="w-full h-11 text-sm font-semibold tracking-normal">
                <Link href="/signup?role=user">
                  Create Traveler Account
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Tour Operator Sign Up Card */}
          <Card className="flex flex-col border border-border bg-card shadow-sm hover:border-primary/40 transition-colors">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <CardTitle className="normal-case tracking-normal text-xl">Sign Up as Operator</CardTitle>
              </div>
              <CardDescription className="text-base">
                Grow your business by listing your tours on our global platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span>Advanced business dashboard</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span>Integrated booking management</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span>Analytics and marketing tools</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button asChild variant="outline" className="w-full h-11 text-sm font-semibold tracking-normal">
                <Link href="/signup?role=operator">
                  Register Business
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-16 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium underline-offset-4">
            Log in here
          </Link>
        </div>
      </main>
    </div>
  );
}
