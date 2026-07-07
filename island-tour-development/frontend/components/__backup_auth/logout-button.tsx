"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      queryClient.clear();
      router.push("/portal");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleLogout} 
      disabled={loading}
    >
      {loading ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
