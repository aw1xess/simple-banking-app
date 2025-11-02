export const rpName = "Simple Banking App";

export const rpID =
  process.env.NODE_ENV === "production"
    ? "your-production-domain.com" // ⚠️ Замініть на ваш домен
    : // : "fishy-nonproblematically-craig.ngrok-free.dev";
      "localhost";

export const rpOrigin =
  process.env.NODE_ENV === "production"
    ? "https://your-production-domain.com" // ⚠️ Замініть на ваш домен
    : // : "https://fishy-nonproblematically-craig.ngrok-free.dev";
      "http://localhost:3000";
