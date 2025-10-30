import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButtons } from "@/components/auth/SignInButtons";

export default async function SignInPage() {
  const session = await getServerSession();
  if (session) redirect("/dashboard");
  return (
    <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
          
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-zinc-600">Sign in to continue</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <SignInButtons />
            <p className="mt-4 text-xs text-zinc-500">
              By continuing, you agree to our <a className="underline" href="#">Terms</a> and <a className="underline" href="#">Privacy Policy</a>.
            </p>
          </div>

          {/* <p className="mt-6 text-center text-sm text-zinc-600">
            Don&apos;t have access yet? <a className="underline" href="#">Request access</a>
          </p> */}
        </div>
      </div>
    </main>
  );
}


