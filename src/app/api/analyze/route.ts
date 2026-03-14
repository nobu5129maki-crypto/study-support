import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createSession } from "@/lib/sessions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "画像が送信されていません" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const base64 = image.replace(/^data:image\/\w+;base64,/, "");
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: `この画像に写っている問題・課題の内容を読み取って、以下のJSON形式で答えてください。
{
  "problem": "問題文や課題の内容をそのままテキストで",
  "subject": "数学|国語|英語|理科|社会|その他 のいずれか"
}
画像が読み取れない、問題が写っていない場合は problem を空文字にしてください。`,
            },
          ],
        },
      ],
    });

    const content = response.text ?? "";
    let parsed: { problem?: string; subject?: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = { problem: content, subject: "その他" };
    }

    const problemText = (parsed.problem ?? "").trim();
    const subject = parsed.subject ?? "その他";

    if (!problemText) {
      return NextResponse.json(
        { error: "問題を読み取れませんでした。もう一度撮影してください。" },
        { status: 400 }
      );
    }

    const sessionId = createSession(problemText, subject);
    return NextResponse.json({ sessionId, problemText, subject });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
