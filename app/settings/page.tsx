"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { toast } from "sonner";
import { UserNav } from "@/components/auth/user-nav";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound } from "lucide-react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  if (status === "loading") {
    return <div>Завантаження...</div>;
  }

  if (!session || !session.user) {
    return null;
  }

  const user = session.user;

  const verifyIdentityFirst = async (): Promise<boolean> => {
    toast.info("Потрібна верифікація", {
      description: "Будь ласка, підтвердіть вашу особу, щоб продовжити.",
    });

    try {
      if (!user?.email) throw new Error("Session not found");

      const optionsRes = await fetch(
        "/api/auth/generate-authentication-options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        }
      );
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error);

      const authResponse = await startAuthentication(options);

      const result = await signIn("credentials", {
        redirect: false,
        email: user.email,
        authResponse: JSON.stringify(authResponse),
        challenge: options.challenge,
        typingPattern: "STEP_UP_AUTH",
      });

      if (result?.ok) {
        toast.success("Особу підтверджено!");
        return true;
      } else {
        throw new Error(result?.error || "Verification Failed");
      }
    } catch (error: any) {
      console.error("Step-up verification failed:", error);
      toast.error("Помилка верифікації", {
        description: error.message || "Невідома помилка",
      });
      return false;
    }
  };

  const registerNewWebauthnKey = async () => {
    try {
      const optionsRes = await fetch(
        "/api/auth/generate-registration-options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        }
      );
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(options.error || "Failed to get registration options");
      }

      const registrationResponse = await startRegistration(options);

      const verificationRes = await fetch("/api/auth/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          registrationResponse,
          challenge: options.challenge,
        }),
      });
      const verificationData = await verificationRes.json();
      if (!verificationRes.ok) {
        throw new Error(verificationData.error || "Verification failed");
      }

      toast.success("Новий автентифікатор успішно додано!");
    } catch (error: any) {
      console.error("New key registration failed:", error);
      toast.error("Помилка додавання ключа", {
        description: error.message || "Невідома помилка",
      });
    }
  };

  const handleAddAuthenticatorClick = async () => {
    setIsLoading(true);

    const isVerified = await verifyIdentityFirst();

    if (isVerified) {
      await registerNewWebauthnKey();
    }

    setIsLoading(false);
  };

  return (
    <div>
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">Simple Bank</h1>
          <UserNav />
        </div>
      </header>
      <main className="container mx-auto max-w-3xl p-4 mt-10">
        <div className="flex flex-col items-center text-center mb-10">
          <h2 className="text-3xl font-semibold">Налаштування безпеки</h2>
          <p className="text-lg text-muted-foreground mt-2 max-w-xl">
            Додайте більше методів автентифікації для кращого захисту вашого
            акаунту та зручного відновлення доступу.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center space-x-4">
              <KeyRound className="h-8 w-8 text-primary" />
              <div>
                <h3 className="text-lg font-medium">Passkeys (WebAuthn)</h3>
                <p className="text-sm text-muted-foreground">
                  Додайте новий автентифікатор одного з ваших девайсів
                </p>
              </div>
            </div>
            <Button onClick={handleAddAuthenticatorClick} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Додати новий
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
