import NextAuth, { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { rpID, rpOrigin } from "@/lib/auth/authUtils";
import { prisma } from "@/lib/prisma";
import { authRateLimiter } from "@/lib/rate-limiter";
import { headers } from "next/headers";
import EmailProvider from "next-auth/providers/email"; // 1. Імпортуйте EmailProvider
import { Resend } from "resend"; // 2. Імпортуйте Resend

const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma as any),
  providers: [
    EmailProvider({
      // Resend не використовує 'server', але ми можемо вказати 'sendVerificationRequest'
      async sendVerificationRequest({ identifier: email, url }) {
        if (!process.env.EMAIL_FROM) {
          console.error("EMAIL_FROM environment variable is not set");
          return;
        }

        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM, // 'onboarding@resend.dev' або ваш домен
            to: email,
            subject: "Ваше посилання для входу в Simple Bank",
            html: `
              <div>
                <p>Натисніть посилання нижче, щоб увійти до свого акаунту:</p>
                <a href="${url}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  Увійти
                </a>
              </div>
            `,
          });
        } catch (error) {
          console.error("Failed to send verification email:", error);
          throw new Error("Failed to send verification email");
        }
      },
    }),
    CredentialsProvider({
      name: "WebAuthn",
      // 'credentials' описує, що ми очікуємо від `signIn()`
      credentials: {
        email: { label: "Email", type: "text" },
        authResponse: { label: "WebAuthn Response", type: "text" },
        challenge: { label: "Challenge", type: "text" },
      },
      async authorize(credentials) {
        if (
          !credentials?.authResponse ||
          !credentials.challenge ||
          !credentials.email
        ) {
          return null;
        }

        const headersList = await headers();
        // 1. АДАПТИВНІСТЬ: Обмеження частоти запитів (Rate Limit)
        const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
        const { success, remaining } = await authRateLimiter.limit(ip);

        if (!success) {
          console.warn(`Rate limit exceeded for IP: ${ip}`);
          throw new Error("Too many requests. Please try again later.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { authenticators: true }, // Включаємо автентифікатори
        });

        if (!user || !user.authenticators.length) {
          throw new Error("User or authenticators not found.");
        }

        // Знаходимо автентифікатор, який намагається використати користувач
        const authResponse = JSON.parse(credentials.authResponse);
        const authenticator = user.authenticators.find(
          (auth) => auth.id === authResponse.id
        );

        if (!authenticator) {
          throw new Error("Authenticator not found for this user.");
        }

        // 2. ВЕРИФІКАЦІЯ WEBAUTHN
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
              // transports:
              //   (authenticator.transports || undefined) &&
              //   (authenticator.transports?.split(
              //     ","
              //   ) as AuthenticatorTransport[]),
            },
            requireUserVerification: true,
          });
        } catch (error) {
          console.error("WebAuthn verification failed:", error);
          throw new Error("Authentication failed.");
        }

        const { verified, authenticationInfo } = verification;

        if (!verified) {
          throw new Error("Could not verify authentication.");
        }

        // 3. АДАПТИВНІСТЬ: Перевірка GEO та User-Agent
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

        if (!isKnownAgent || !isKnownGeo) {
          // **ЦЕ ВАША АДАПТИВНА ЛОГІКА**
          // Ми виявили підозрілу поведінку.
          // У цьому прикладі ми *відхиляємо* вхід і просимо пройти дод. фактор.
          // (У вашій моделі ви б тут запросили другий фактор)

          // Для демонстрації, давайте просто повернемо помилку
          // У реальному додатку ви б встановили 'partial_auth' в сесії
          // і перенаправили на сторінку 2FA.

          // Оскільки у нас зараз лише один фактор, давайте відхилимо
          console.warn(`Suspicious login detected for ${user.email}`);
          // throw new Error("Suspicious activity detected. Additional verification required.");

          // Або, для демонстрації, давайте просто "позначимо" це, але пропустимо
          // і додамо новий пристрій/гео до списку відомих
          if (!isKnownAgent) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                knownUserAgents: {
                  push: { userAgent, date: new Date().toISOString() },
                },
              },
            });
          }
          if (!isKnownGeo) {
            await prisma.user.update({
              where: { id: user.id },
              data: { knownGeoLocations: { push: geo } },
            });
          }
        }

        // Оновлюємо лічильник автентифікатора в БД
        await prisma.authenticator.update({
          where: { id: authenticator.id },
          data: { counter: authenticationInfo.newCounter },
        });

        // Успішний вхід! Повертаємо користувача
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
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
    verifyRequest: "/login/verify-request", // Вкажіть вашу сторінку входу
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
