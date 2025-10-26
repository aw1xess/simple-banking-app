// app/login/page.tsx
import { AuthForm } from "@/components/auth/auth-form";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  // Якщо користувач вже увійшов, перенаправити на дашборд
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <AuthForm />
    </main>
  );
}
