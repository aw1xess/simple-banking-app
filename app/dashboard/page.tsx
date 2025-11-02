"use client";

import { UserNav } from "@/components/auth/user-nav";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startAuthentication } from "@simplewebauthn/browser";
import { CreditCard, DollarSign } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

export default function DashboardPage() {
  const [cardNumber, setCardNumber] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Завантаження...</div>;
  }

  if (!session) {
    return null;
  }

  const user = session.user;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    toast("Потрібна повторна верифікація", {
      description: "Підтвердіть вашу особу, щоб продовжити.",
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
      });

      if (result?.ok) {
        toast.success("Особу підтверджено!", {
          description: "Переказ коштів успішний!",
        });
      } else {
        throw new Error(result?.error || "Verification failed");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка верифікації", {
        description: error.message || "Невідома помилка",
      });
    }
  };

  const handlePaymentAmountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPaymentAmount(event.target.value);
  };

  const handleCardNumberChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const cleanedValue = event.target.value.replace(/\D/g, "");

    const groups = cleanedValue.match(/.{1,4}/g) || [];

    const formattedValue = groups.join(" ").substring(0, 19);

    setCardNumber(formattedValue);
  };

  return (
    <div>
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">Simple Bank</h1>
          <UserNav />
        </div>
      </header>
      <main className="container mx-auto p-4 flex flex-col items-center justify-center gap-10 h-full mt-20">
        <h2 className="text-3xl font-semibold">Головна сторінка</h2>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Здійснити переказ коштів</CardTitle>
            <CardDescription>
              Введіть 16-значний номер вашої картки.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handlePayment}>
            <CardContent className="mb-4">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Номер картки</Label>
                <div className="relative">
                  <Input
                    id="payment-amount"
                    placeholder="0"
                    type="numeric"
                    value={paymentAmount}
                    onChange={handlePaymentAmountChange}
                    maxLength={10}
                    className="pl-10 text-lg tracking-wider"
                  />
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                </div>
                <Label htmlFor="card-number">Номер картки</Label>
                <div className="relative">
                  <Input
                    id="card-number"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    maxLength={19}
                    className="pl-10 text-lg tracking-wider"
                  />
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={cardNumber.length < 19}
              >
                Відправити
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
