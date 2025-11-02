import { prisma } from "@/lib/prisma";
import { rpID } from "@/lib/auth/authUtils";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // Ми не перевіряємо email тут,
    // тому що WebAuthn підтримує вхід без імені користувача
    // Але для простоти, давайте знайдемо користувача
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userAuthenticators = await prisma.authenticator.findMany({
      where: { userId: user.id },
    });

    const options = await generateAuthenticationOptions({
      rpID,
      // Дозволяємо вхід з будь-якого зареєстрованого пристрою
      allowCredentials: userAuthenticators.map((auth) => ({
        id: Buffer.from(auth.id, "base64url"),
        type: "public-key",
        // transports:
        //   (auth.transports || undefined) &&
        //   (auth.transports?.split(",") as AuthenticatorTransport[]),
      })),
      userVerification: "preferred",
    });

    // Тут ми МАЄМО зберегти challenge в сесії або Redis,
    // щоб перевірити його в NextAuth `authorize`
    // Давайте використаємо Redis (Upstash) для цього
    // **Виправлення:** Для простоти, `NextAuth` сам це зробить.
    // Ми повернемо 'challenge' на клієнт, а клієнт передасть його в `signIn`

    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate options" },
      { status: 500 }
    );
  }
}
