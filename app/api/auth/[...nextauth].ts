// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";

// Ініціалізуємо Prisma Client
const prisma = new PrismaClient();

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      // Назва вашого провайдера
      name: "WebAuthn",
      // 'credentials' тут є формальністю
      credentials: {
        response: { label: "WebAuthn Response", type: "text" },
      },
      async authorize(credentials) {
        // ТУТ ВІДБУДЕТЬСЯ МАГІЯ
        // 1. Отримати 'credentials.response'
        // 2. Викликати @simplewebauthn/server 'verification'
        // 3. Якщо перевірка успішна, знайти користувача в 'prisma'
        // 4. Повернути об'єкт 'user'
        // 5. Якщо ні - повернути 'null'

        // Це лише ЗАГЛУШКА, її треба буде замінити
        console.log("Authorize function called", credentials);
        // Наприклад, ви знайдете користувача після перевірки WebAuthn
        const user = await prisma.user.findUnique({
          where: { email: "test@example.com" }, // Це лише приклад
        });

        if (user) {
          return user; // Успішний вхід
        } else {
          return null; // Помилка входу
        }
      },
    }),
  ],
  session: {
    // Використовуйте JWT для сесій, це простіше для кастомної логіки
    strategy: "jwt",
  },
  callbacks: {
    // Додаємо ID користувача у JWT токен
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Додаємо ID користувача у об'єкт сесії
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  // Додайте змінну середовища для 'secret' у ваш .env файл
  secret: process.env.NEXTAUTH_SECRET,
});

// Експортуємо GET та POST хендлери для App Router
export { handler as GET, handler as POST };
