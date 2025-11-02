export const rpName = "Simple Banking App";

export const rpID =
  process.env.NODE_ENV === "production"
    ? "simple-banking-app-iota.vercel.app" // ⚠️ Замініть на ваш домен
    : // : "fishy-nonproblematically-craig.ngrok-free.dev";
      "localhost";

export const rpOrigin =
  process.env.NODE_ENV === "production"
    ? "https://simple-banking-app-iota.vercel.app" // ⚠️ Замініть на ваш домен
    : // : "https://fishy-nonproblematically-craig.ngrok-free.dev";
      "http://localhost:3000";
