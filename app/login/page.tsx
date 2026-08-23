import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import {
  getAuthConfigError,
  getSession,
  isDashboardAuthDisabled,
  isAuthenticated,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isDashboardAuthDisabled()) {
    redirect("/");
  }

  const configError = getAuthConfigError();
  const session = configError ? null : await getSession();

  if (session && isAuthenticated(session)) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <LoginForm />
    </main>
  );
}
