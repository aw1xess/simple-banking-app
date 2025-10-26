// app/dashboard/page.tsx
import { UserNav } from "@/components/auth/user-nav";

export default function DashboardPage() {
  // Ця сторінка захищена за допомогою middleware

  return (
    <div>
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">Simple Bank</h1>
          <UserNav />
        </div>
      </header>
      <main className="container mx-auto p-4">
        <h2 className="text-2xl font-semibold">Ваша Панель Керування</h2>
        <p>Ви успішно увійшли за допомогою WebAuthn.</p>

        {/*
          СЮДИ ВИ ДОДАСТЕ СВІЙ БАНКІВСЬКИЙ ФУНКЦІОНАЛ
          (наприклад, форма "Переказ коштів", яка запускатиме
          адаптивну логіку додаткової перевірки)
        */}
      </main>
    </div>
  );
}
