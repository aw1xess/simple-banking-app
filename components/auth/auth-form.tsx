// components/auth/auth-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function AuthForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  /**
   * Обробник реєстрації
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // ... (логіка fetch)
      const optionsRes = await fetch(
        "/api/auth/generate-registration-options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name }),
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
        // Додайте 'challenge' сюди:
        body: JSON.stringify({
          email,
          registrationResponse,
          challenge: options.challenge, // <--- 💡 ВИПРАВЛЕННЯ
        }),
      });
      const verificationData = await verificationRes.json();
      if (!verificationRes.ok) {
        throw new Error(verificationData.error || "Verification failed");
      }

      // 3. Оновіть виклик toast
      toast.success("Реєстрація успішна!", {
        description: "Тепер ви можете увійти, використовуючи свій пристрій.",
      });
    } catch (error: any) {
      console.error(error);
      // 3. Оновіть виклик toast
      toast.error("Помилка реєстрації", {
        description: error.message || "Невідома помилка",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Обробник входу
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // ... (логіка fetch)
      const optionsRes = await fetch(
        "/api/auth/generate-authentication-options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(
          options.error || "Failed to get authentication options"
        );
      }

      const authResponse = await startAuthentication(options);

      const result = await signIn("credentials", {
        redirect: false,
        email: email,
        authResponse: JSON.stringify(authResponse),
        challenge: options.challenge,
      });

      if (result?.ok) {
        // 4. (Опціонально) Можна додати toast успіху і тут
        toast.success("Вхід успішний!");
        router.push("/dashboard");
      } else {
        throw new Error(result?.error || "Не вдалося увійти");
      }
    } catch (error: any) {
      console.error(error);
      // 3. Оновіть виклик toast
      toast.error("Помилка входу", {
        description: error.message || "Невідома помилка",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... (решта JSX коду форми залишається без змін)
  return (
    <Tabs defaultValue="login" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Вхід</TabsTrigger>
        <TabsTrigger value="register">Реєстрація</TabsTrigger>
      </TabsList>

      {/* ВКЛАДКА ВХОДУ */}
      <TabsContent value="login">
        <Card>
          <CardHeader>
            <CardTitle>Вхід</CardTitle>
            <CardDescription>
              Використайте ваш пристрій (Face ID, Touch ID, ключ) для входу.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-login">Email</Label>
                  <Input
                    id="email-login"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Увійти з Passkey
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ВКЛАДКА РЕЄСТРАЦІЇ */}
      <TabsContent value="register">
        <Card>
          <CardHeader>
            <CardTitle>Реєстрація</CardTitle>
            <CardDescription>
              Створіть акаунт та зареєструйте свій пристрій.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name-register">
                    Ім&apos;я (необов&apos;язково)
                  </Label>
                  <Input
                    id="name-register"
                    placeholder="Ваше ім'я"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-register">Email</Label>
                  <Input
                    id="email-register"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Зареєструвати пристрій
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
