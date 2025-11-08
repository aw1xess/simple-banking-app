export const rpName = "Simple Banking App";

export const rpID =
  process.env.NODE_ENV === "production"
    ? "simple-banking-app-iota.vercel.app"
    : "localhost";

export const rpOrigin =
  process.env.NODE_ENV === "production"
    ? "https://simple-banking-app-iota.vercel.app"
    : "http://localhost:3000";
