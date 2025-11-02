// app/login/verify-request/page.tsx
import { MailCheck } from "lucide-react";
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <MailCheck size={64} className="mb-4 text-green-500" />
      <h1 className="text-2xl font-bold mb-2">Перевірте свою пошту</h1>
      <p className="text-muted-foreground mb-6">
        Ми надіслали вам посилання для входу.
      </p>
      <Link href="/" className="text-sm underline">
        Повернутися на головну
      </Link>
    </main>
  );
}
