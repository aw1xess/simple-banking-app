// app/api/auth/verify-registration/route.ts
import { prisma } from "@/lib/prisma";
import { rpID, rpOrigin } from "@/lib/auth/authUtils";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { VerifiedRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const body = await request.json();

    const { email, registrationResponse, challenge, typingPattern } = body;

    if (!email || !registrationResponse || !challenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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

    await prisma.authenticator.create({
      data: {
        userId: user.id,
        id: Buffer.from(credentialID).toString("base64url"),
        credentialPublicKey: Buffer.from(credentialPublicKey),
        counter,
        credentialDeviceType,
        credentialBackedUp,
      },
    });

    if (typingPattern) {
      try {
        const response = await fetch(
          `https://api.typingdna.com/save/${email}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
              Authorization:
                "Basic " +
                Buffer.from(
                  process.env.TYPINGDNA_API_KEY +
                    ":" +
                    process.env.TYPINGDNA_API_SECRET
                ).toString("base64"),
            },
            body: JSON.stringify({
              tp: typingPattern,
            }),
          }
        );
        if (!response.ok) {
          const errorData = await response.json();
          console.error("TypingDNA save failed:", errorData.message);
        }
      } catch (e) {
        console.error("Server-side fetch to TypingDNA failed:", e);
      }
    }

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
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Failed to verify registration" },
      { status: 500 }
    );
  }
}
