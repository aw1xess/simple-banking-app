import { prisma } from "@/lib/prisma";
import { rpID, rpOrigin } from "@/lib/authUtils";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { VerifiedRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // 1. Отримайте 'challenge' з тіла запиту
    const { email, registrationResponse, challenge } = body;

    if (!email || !registrationResponse || !challenge) {
      // <--- 💡 Додайте перевірку
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Встановіть 'expectedChallenge' з того, що прийшло в 'body'
    const expectedChallenge = challenge;

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin: rpOrigin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return NextResponse.json(
        { error: "Could not verify registration" },
        { status: 400 }
      );
    }

    const {
      credentialPublicKey,
      credentialID,
      counter,
      credentialDeviceType,
      credentialBackedUp,
    } = registrationInfo;

    // Зберігаємо новий автентифікатор в БД
    await prisma.authenticator.create({
      data: {
        userId: user.id,
        credentialID: Buffer.from(credentialID).toString("base64url"),
        credentialPublicKey: Buffer.from(credentialPublicKey),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: registrationResponse.response.transports?.join(","),
      },
    });

    // Оновлюємо метадані користувача для адаптивної логіки
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "unknown";
    const geo = {
      city: headersList.get("x-vercel-ip-city") || "unknown",
      country: headersList.get("x-vercel-ip-country") || "unknown",
    };

    await prisma.user.update({
      where: { id: user.id },
      data: {
        knownUserAgents: {
          push: { userAgent, date: new Date().toISOString() },
        },
        knownGeoLocations: {
          push: geo,
        },
      },
    });

    return NextResponse.json({ success: true, verified });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to verify registration" },
      { status: 500 }
    );
  }
}
