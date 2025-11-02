import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Отримуємо *новий* патерн ТА *email* (який може бути)
    const { pattern, email } = await request.json();
    if (!pattern) {
      return NextResponse.json(
        { error: "New pattern missing" },
        { status: 400 }
      );
    }

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

    // 5. Повертаємо результат клієнту (без змін)
    return NextResponse.json({
      result: data.result === 1,
      score: data.score,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "API comparison failed" },
      { status: 500 }
    );
  }
}
