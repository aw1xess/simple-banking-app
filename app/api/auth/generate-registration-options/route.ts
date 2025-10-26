// app/api/auth/generate-registration-options/route.ts
import { prisma } from "@/lib/prisma";
import { rpID, rpName } from "@/lib/authUtils";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { Authenticator } from "@/lib/generated/prisma/client";

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Перевіряємо, чи користувач вже існує
    let user = await prisma.user.findUnique({ where: { email } });

    // Якщо не існує, створюємо нового
    if (!user) {
      user = await prisma.user.create({
        data: { email, name },
      });
    }

    // Отримуємо існуючі автентифікатори
    const userAuthenticators: Authenticator[] =
      await prisma.authenticator.findMany({
        where: { userId: user.id },
      });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email,
      attestationType: "none",
      //@ts-expect-error sdsdds
      excludeCredentials: userAuthenticators.map((auth: Authenticator) => ({
        id: auth.credentialID,
        type: "public-key",
        transports:
          (auth.transports || undefined) &&
          (auth.transports?.split(",") as AuthenticatorTransport[]),
      })),
      authenticatorSelection: {
        // Вимагаємо, щоб пристрій підтримував 'passkeys'
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    // Тимчасово зберігаємо 'challenge' для цього користувача
    // У production тут краще використовувати Redis або сесію
    // Для простоти, ми можемо зберегти його в Next-Auth сесії (але її ще немає)
    // АБО тимчасово в БД (поганий підхід)
    // Давайте використаємо сесію (якщо вона вже є) або просто передамо.
    // **Виправлення:** Для реєстрації ми просто передаємо challenge на клієнт.
    // Клієнт поверне його нам на ендпоінт верифікації.

    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate options" },
      { status: 500 }
    );
  }
}
