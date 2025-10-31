"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/header/UserMenu";
import CreditsDisplay from "@/components/header/CreditsDisplay";
import UpgradeButton from "@/components/header/UpgradeButton";
import { useBillingStore } from "@/lib/state/billing";

type Props = {
  userEmail: string | null | undefined;
  userImage: string | null;
  isSignedIn: boolean;
};

export default function HeaderNav({ userEmail, userImage, isSignedIn }: Props) {
  const refresh = useBillingStore((s) => s.refresh);

  // Hydrate billing store on mount for logged-in users
  useEffect(() => {
    if (isSignedIn) {
      refresh();
    }
  }, [isSignedIn, refresh]);

  if (!isSignedIn) {
    return (
      <Link href="/signin" prefetch>
        <Button variant="primary" size="md">
          <span>Sign in</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  return (
    <>
      <CreditsDisplay />
      <UpgradeButton />
      <Link href="/dashboard" prefetch className="hidden sm:inline opacity-90 hover:opacity-100">
        Dashboard
      </Link>
      <UserMenu email={userEmail} image={userImage} />
    </>
  );
}

