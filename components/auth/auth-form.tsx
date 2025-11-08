// components/auth/auth-form.tsx
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
  const [isLoadingMagicLink, setIsLoadingMagicLink] = useState(false);
  const [isLoadingRegister, setIsLoadingRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");

  const [showStep2, setShowStep2] = useState(false);

  useEffect(() => {
    if (window.TypingDNA) {
      const tdna = new window.TypingDNA();
      tdna.addTarget("name-register");
      tdna.addTarget("email-register");
      tdna.addTarget("email-register-confirm");
      tdna.addTarget("email-login");
    } else {
      const interval = setInterval(() => {
        if (window.TypingDNA) {
          clearInterval(interval);
          const tdna = new window.TypingDNA();
          tdna.addTarget("email-register");
          tdna.addTarget("email-login");
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    toast.error("Вставка тексту заборонена", {
      description: "Будь ласка, введіть дані вручну для реєстрації патерну.",
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

      if (!typingPattern) {
        throw new Error("Не вдалося записати патерн друку. Спробуйте ще раз.");
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
      if (!optionsRes.ok) throw new Error(options.error);

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
      if (!verificationData.success) {
        throw new Error(verificationData.error || "Verification failed");
      }

      toast.success("Реєстрація успішна!", {
        description: "Тепер ви можете увійти, використовуючи свій пристрій.",
      });
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка реєстрації", {
        description: error.message || "Невідома помилка",
      });
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingPasskey(true);

    try {
      let typingPattern = null;
      if (window.TypingDNA) {
        const tdna = new window.TypingDNA();
        typingPattern = tdna.getTypingPattern({ type: 1, text: loginEmail });
      }

      if (!typingPattern) {
        throw new Error("Не вдалося записати патерн друку для верифікації.");
      }

      const optionsRes = await fetch(
        "/api/auth/generate-authentication-options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail }),
        }
      );
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error);

      const authResponse = await startAuthentication(options);

      const result = await signIn("credentials", {
        redirect: false,
        email: loginEmail,
        authResponse: JSON.stringify(authResponse),
        challenge: options.challenge,
        typingPattern: typingPattern,
      });

      if (result?.ok) {
        toast.success("Вхід (Passkey) успішний!");
        router.push("/dashboard");
      } else if (result?.error === "NEEDS_SECOND_FACTOR") {
        toast.warning("Потрібна додаткова верифікація", {
          description: "Ми помітили незвичну поведінку під час автентифікації",
        });
        setShowStep2(true);
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

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingMagicLink(true);
    try {
      const result = await signIn("email", {
        email: loginEmail,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (result?.error) throw new Error(result.error);
      router.push("/login/verify-request");
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка (Email)", {
        description: error.message || "Не вдалося відправити посилання",
      });
    } finally {
      setIsLoadingMagicLink(false);
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
            <CardTitle>{!showStep2 ? "Вхід" : "Крок 2: Верифікація"}</CardTitle>
            <CardDescription>
              {!showStep2
                ? "Увійдіть за допомогою Passkey."
                : "Підтвердіть, що це ви, за допомогою посилання."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showStep2 ? (
              <>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="email-login">Email</Label>
                  <Input
                    id="email-login"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoadingPasskey}
                  />
                </div>
                <form onSubmit={handlePasskeyLogin} className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoadingPasskey || !loginEmail}
                  >
                    {isLoadingPasskey && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Увійти
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="space-y-2 mb-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Для завершення входу, будь ласка, підтвердіть, що це ви,
                    отримавши посилання на:
                  </p>
                  <p className="font-semibold">{email}</p>
                </div>
                <form
                  onSubmit={handleMagicLinkLogin}
                  className="space-y-2 mt-4"
                >
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={isLoadingMagicLink}
                  >
                    {isLoadingMagicLink && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Надіслати посилання
                  </Button>
                  <Button
                    variant="link"
                    type="button"
                    className="w-full"
                    onClick={() => setShowStep2(false)}
                  >
                    Скасувати
                  </Button>
                </form>
              </>
            )}
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
