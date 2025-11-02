import { prisma } from "@/lib/prisma";
import { rpID, rpName } from "@/lib/auth/authUtils";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { Authenticator, User } from "@/lib/generated/prisma";

export async function generateAuthenticatorsPool(user: User) {
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
    excludeCredentials: userAuthenticators.map((auth: Authenticator) => ({
      id: Buffer.from(auth.id, "base64url"),
      type: "public-key",
    })),
    authenticatorSelection: {
      userVerification: "preferred",
    },
  });

  return options;
}
