import { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { rpID, rpOrigin } from "@/lib/auth/authUtils";

const resend = new Resend(process.env.RESEND_API_KEY);

async function verifyTypingPattern(
  pattern: string,
  email: string
): Promise<{ result?: boolean; score?: number; error?: string }> {
  if (pattern === "STEP_UP_AUTH") {
    return { result: true, score: 100 };
  }
  try {
    const response = await fetch(`https://api.typingdna.com/verify/${email}`, {
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
        tp: pattern,
        quality: 2,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`TypingDNA API error: ${errorData.message}`);
    }

    const data = await response.json();

    return {
      result: data.result === 1,
      score: data.score,
    };
  } catch (error: any) {
    console.error(error);
    return { error: error.message || "API comparison failed" };
  }
}

// 💡 ТУТ ТЕПЕР ЖИВЕ ВАШ ОБ'ЄКТ. 'export' тут - це правильно.
export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma as any),
  providers: [
    EmailProvider({
      async sendVerificationRequest({ identifier: email, url }) {
        if (!process.env.EMAIL_FROM) {
          console.error("EMAIL_FROM environment variable is not set");
          return;
        }
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM!,
            to: email,
            subject: "Ваше посилання для входу в Simple Bank",
            html: `<p>Натисніть <a href="${url}">це посилання</a> щоб увійти.</p>`,
          });
        } catch (error) {
          console.error("Failed to send verification email:", error);
          throw new Error("Failed to send verification email");
        }
      },
    }),

    CredentialsProvider({
      name: "WebAuthn",
      credentials: {
        email: { label: "Email", type: "text" },
        authResponse: { label: "WebAuthn Response", type: "text" },
        challenge: { label: "Challenge", type: "text" },
        typingPattern: { label: "Typing Pattern", type: "text" },
      },
      async authorize(credentials) {
        if (
          !credentials?.authResponse ||
          !credentials.challenge ||
          !credentials.email ||
          !credentials.typingPattern
        ) {
          console.error("Missing credentials fields");
          return null;
        }

        const headersList = await headers();

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { authenticators: true },
        });

        if (!user || !user.authenticators.length) {
          throw new Error("User or authenticators not found.");
        }

        const authResponse = JSON.parse(credentials.authResponse);
        const authenticator = user.authenticators.find(
          (auth) => auth.id === authResponse.id
        );

        if (!authenticator) {
          throw new Error("Authenticator not found.");
        }

        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response: authResponse,
            expectedChallenge: credentials.challenge,
            expectedOrigin: rpOrigin,
            expectedRPID: rpID,
            authenticator: {
              credentialID: Buffer.from(authenticator.id, "base64url"),
              credentialPublicKey: authenticator.credentialPublicKey,
              counter: authenticator.counter,
            },
            requireUserVerification: true,
          });
        } catch (error) {
          console.error("WebAuthn verification failed:", error);
          throw new Error("Authentication failed.");
        }

        if (!verification.verified) {
          throw new Error("Could not verify authentication.");
        }

        let isKnownGeo = false;
        let isKnownAgent = false;
        let isTypingPatternMatch = false;

        const geo = {
          city: headersList.get("x-vercel-ip-city") || "unknown",
          country: headersList.get("x-vercel-ip-country") || "unknown",
        };
        isKnownGeo = user.knownGeoLocations.some(
          (loc: any) => loc.city === geo.city && loc.country === geo.country
        );

        const userAgent = headersList.get("user-agent") || "unknown";
        isKnownAgent = user.knownUserAgents.some(
          (agent: any) => agent.userAgent === userAgent
        );

        if (!credentials.typingPattern) {
          console.warn(`User ${user.id} has no enrolled typing pattern.`);
          isTypingPatternMatch = false;
        } else {
          const verificationResult = await verifyTypingPattern(
            credentials.typingPattern,
            credentials.email
          );
          isTypingPatternMatch = verificationResult.result ?? false;
        }

        const isSecure = isKnownGeo && isKnownAgent && isTypingPatternMatch;

        if (isSecure) {
          console.log(`Low-risk login for ${user.email}. All checks passed.`);

          await prisma.authenticator.update({
            where: { id: authenticator.id },
            data: { counter: verification.authenticationInfo.newCounter },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } else {
          console.warn(`High-risk login for ${user.email}. Step-up required.`);
          console.log({ isKnownGeo, isKnownAgent, isTypingPatternMatch });

          throw new Error("NEEDS_SECOND_FACTOR");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
  },
};
