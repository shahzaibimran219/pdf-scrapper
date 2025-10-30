"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn } from "lucide-react";

export function SignInButtons() {
  const [loading, setLoading] = useState(false);
  const onGoogle = async () => {
    try {
      setLoading(true);
      await signIn("google", { callbackUrl: "/dashboard" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={onGoogle}
        variant="primary"
        className="inline-flex items-center gap-2"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Continue with Google
          </>
        )}
      </Button>
    </div>
  );
}


