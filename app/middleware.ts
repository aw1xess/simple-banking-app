// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login", // Перенаправляти неавтентифікованих сюди
  },
});

export const config = {
  // Застосувати middleware до цих маршрутів
  matcher: [
    "/dashboard",
    // Додайте сюди інші захищені сторінки
    // "/settings",
  ],
};
