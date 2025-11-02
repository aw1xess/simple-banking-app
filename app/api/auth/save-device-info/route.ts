import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { knownGeoLocations: true, knownUserAgents: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "unknown";
    const geo = {
      city: headersList.get("x-vercel-ip-city") || "unknown",
      country: headersList.get("x-vercel-ip-country") || "unknown",
    };

    const isKnownAgent = user.knownUserAgents.some(
      (agent: any) => agent.userAgent === userAgent
    );
    const isKnownGeo = user.knownGeoLocations.some(
      (loc: any) => loc.city === geo.city && loc.country === geo.country
    );

    // Оновлюємо, лише якщо щось нове
    if (!isKnownAgent || !isKnownGeo) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          knownUserAgents: isKnownAgent
            ? undefined
            : { push: { userAgent, date: new Date().toISOString() } },
          knownGeoLocations: isKnownGeo ? undefined : { push: geo },
        },
      });
      console.log(`Saved new device/geo for user ${session.user.id}`);
    }

    return NextResponse.json({
      success: true,
      updated: !isKnownAgent || !isKnownGeo,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Failed to save device info" },
      { status: 500 }
    );
  }
}
