import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  getSession,
  updateSession,
  type SessionData,
} from "@/lib/sessions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DIFFICULTY_PROMPTS: Record<number, string> = {
  0: "標準的な説明で、専門用語は必要に応じて使ってください。",
  1: "中学生でも理解できるように、やや易しい言葉で説明してください。専門用語は簡単な言葉に言い換えてください。",
  2: "小学生高学年でも理解できるように、とても易しい言葉で、具体例を多く使って説明してください。",
};

function buildSystemInstruction(data: SessionData): string {
  const diff = DIFFICULTY_PROMPTS[data.difficultyLevel] ?? DIFFICULTY_PROMPTS[0];
  return `あなたは優しい家庭教師です。${data.subject}の質問に答えます。

【重要なルール】
1. 解説は必ず1ステップずつ進めます。一度に全部説明しないでください。
2. 各ステップの最後に「ここまで理解できたかな？」と確認する形で終えてください。
3. 説明は${diff}
4. 回答は日本語で、簡潔に。`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      action?: "next" | "simplify";
    };
    const { sessionId, action = "next" } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "セッションIDが必要です" },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "セッションが期限切れです。最初からやり直してください。" },
        { status: 404 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    if (action === "simplify") {
      updateSession(sessionId, (s) => {
        s.difficultyLevel = Math.min(2, s.difficultyLevel + 1);
      });
    }

    const updated = getSession(sessionId)!;

    const userContent =
      updated.stepIndex === 0
        ? "まず最初のステップから始めてください。"
        : action === "simplify"
          ? "前の説明が難しかったようなので、もっと易しい言葉で同じ内容を説明し直してください。"
          : "前のステップは理解できたとのことなので、次のステップを説明してください。";

    const historyContents = updated.messages.map((m) => ({
      role: (m.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const currentUserContent = `【問題】
${updated.problemText}

この問題を、1ステップずつ解説してください。${userContent}`;

    const contents = [
      ...historyContents,
      {
        role: "user" as const,
        parts: [{ text: currentUserContent }],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: buildSystemInstruction(updated),
        maxOutputTokens: 800,
      },
    });

    const content = response.text ?? "";

    if (action === "simplify") {
      // 易しい説明に差し替え。履歴には追加せず、stepIndexもそのまま
    } else {
      updateSession(sessionId, (s) => {
        s.messages.push({
          role: "user",
          content: `この問題を、1ステップずつ解説してください。${userContent}`,
        });
        s.messages.push({ role: "assistant", content });
        s.stepIndex += 1;
      });
    }

    const stepIndex =
      action === "simplify" ? updated.stepIndex : updated.stepIndex + 1;

    return NextResponse.json({
      explanation: content,
      stepIndex,
      difficultyLevel: getSession(sessionId)!.difficultyLevel,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "解説の取得に失敗しました" },
      { status: 500 }
    );
  }
}
