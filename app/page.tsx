// app/page.tsx
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Button } from "@/components/ui/button";
import { getServerSession } from "next-auth/next";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Демо Адаптивної Автентифікації
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Проєкт для демонстрації WebAuthn та адаптивних факторів.
        </p>

        {session ? (
          <Button asChild size="lg">
            <Link href="/dashboard">Перейти до Панелі Керування</Link>
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href="/login">Увійти або Зареєструватися</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
