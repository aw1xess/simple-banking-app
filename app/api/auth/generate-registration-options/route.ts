import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateAuthenticatorsPool } from "@/lib/auth/registrateAuthenticationMethod";

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: { email, name },
      });
    }

    const options = await generateAuthenticatorsPool(user);

    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate options" },
      { status: 500 }
    );
  }
}
