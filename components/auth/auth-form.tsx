"use client";

import { useState, useEffect } from "react";
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

  const [isLoadingPasskey, setIsLoadingPasskey] = useState(false);
  const [isLoadingRegister, setIsLoadingRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.TypingDNA) {
        clearInterval(interval);
        const tdna = new window.TypingDNA();

        tdna.addTarget("email-register");
        tdna.addTarget("email-login");
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    toast.error("Вставка тексту заборонена", {
      description:
        "Будь ласка, введіть дані вручну для реєстрації патерну друку.",
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoadingRegister(true);

    try {
      const textToType = email;
      let typingPattern = null;

      if (window.TypingDNA) {
        const tdna = new window.TypingDNA();
        typingPattern = tdna.getTypingPattern({ type: 1, text: textToType });
      }

      const typingPatternRes = await fetch("/api/auth/save-typing-pattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: typingPattern,
          email: email,
        }),
      });

      const typingPatternData = await typingPatternRes.json();

      if (!typingPatternRes.ok) {
        throw new Error(
          typingPatternData.error || "Saving typing pattern failed"
        );
      }

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
        body: JSON.stringify({
          email,
          registrationResponse,
          challenge: options.challenge,
          typingPattern: typingPattern,
        }),
      });

      const verificationData = await verificationRes.json();
      if (!verificationRes.ok) {
        throw new Error(verificationData.error || "Verification failed");
      }

      toast.success("Реєстрація успішна!", {
        description: "Тепер ви можете увійти у формі з логіном",
      });
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка реєстрації", {
        description: error.message || "Невідома помилка",
      });
    } finally {
      setEmail("");
      setIsLoadingRegister(false);
    }
  };

  const runTypingVerification = async (): Promise<boolean> => {
    try {
      const textToVerify = email;
      let typingPattern = null;

      if (window.TypingDNA) {
        const tdna = new window.TypingDNA();
        typingPattern = tdna.getTypingPattern({ type: 1, text: textToVerify });
      }

      const res = await fetch("/api/auth/verify-typing-pattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: typingPattern,
          email: textToVerify,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "API comparison failed");
      }
      return true;
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка верифікації патерну", {
        description: error.message,
      });
      return false;
    }
  };

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingPasskey(true);

    try {
      const patternVerified = await runTypingVerification();
      if (!patternVerified) {
        setIsLoadingPasskey(false);
        return;
      }

      const optionsRes = await fetch(
        "/api/auth/generate-authentication-options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error);

      const authResponse = await startAuthentication(options);

      const result = await signIn("credentials", {
        redirect: false,
        email: email,
        authResponse: JSON.stringify(authResponse),
        challenge: options.challenge,
      });

      if (result?.ok) {
        toast.success("Вхід (Passkey) успішний!");
        router.push("/dashboard");
      } else {
        throw new Error(result?.error || "Не вдалося увійти");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка входу (Passkey)", {
        description: error.message || "Невідома помилка",
      });
    } finally {
      setIsLoadingPasskey(false);
    }
  };

  return (
    <Tabs defaultValue="login" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Вхід</TabsTrigger>
        <TabsTrigger value="register">Реєстрація</TabsTrigger>
      </TabsList>
      <TabsContent value="login">
        <Card>
          <CardHeader>
            <CardTitle>Вхід</CardTitle>
            <CardDescription>
              Введіть email для перевірки патерну друку та увійдіть з Passkey.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <Label htmlFor="email-login">Email</Label>
              <Input
                id="email-login"
                type="email"
                placeholder="m@example.com"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <form onSubmit={handlePasskeyLogin} className="space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoadingPasskey || !email}
              >
                {isLoadingPasskey && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Увійти з Passkey
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="register">
        <Card>
          <CardHeader>
            <CardTitle>Реєстрація</CardTitle>
            <CardDescription>
              Введіть ваші дані вручну. Вставка заборонена.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name-register">Ім&apos;я</Label>
                  <Input
                    id="name-register"
                    placeholder="Ваше ім'я"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onPaste={handlePaste}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-register">Email</Label>
                  <Input
                    id="email-register"
                    type="email"
                    placeholder="m@example.com"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onPaste={handlePaste}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoadingRegister || !email}
                >
                  {isLoadingRegister && (
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
