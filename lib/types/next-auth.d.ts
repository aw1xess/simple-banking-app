// types/next-auth.d.ts

import "next-auth";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

// 1. Розширюємо тип User (який повертається з 'authorize')
declare module "next-auth" {
  /**
   * Розширюємо стандартний тип User, додаючи id
   */
  interface User {
    id: string;
    // ...інші ваші поля, якщо є (name, email)
  }

  /**
   * Розширюємо стандартний тип Session, додаючи id до об'єкта user
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"]; // Об'єднуємо з існуючими полями (name, email, image)
  }
}

// 2. Розширюємо тип JWT (який використовується у колбеку 'jwt')
declare module "next-auth/jwt" {
  /** Розширюємо токен, щоб він містив id */
  interface JWT {
    id: string;
  }
}
