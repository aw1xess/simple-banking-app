import { prisma } from "@/lib/prisma";
import { rpID } from "@/lib/auth/authUtils";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: { authenticators: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.authenticators.map((auth) => ({
        id: Buffer.from(auth.id, "base64url"),
        type: "public-key",
      })),
      userVerification: "preferred",
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate options" },
      { status: 500 }
    );
  }
}
