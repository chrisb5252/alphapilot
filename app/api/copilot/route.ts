import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildPortfolioContext,
  createFallbackResponse,
} from "@/lib/copilot/portfolio-context";
import type { CopilotMessage } from "@/lib/copilot/types";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1500;

const responseFormat = {
  type: "json_schema" as const,
  name: "investment_copilot_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      highlights: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
      },
      caveat: { type: "string" },
      suggestedQuestions: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 3,
      },
    },
    required: ["answer", "highlights", "caveat", "suggestedQuestions"],
  },
};

function isValidMessage(value: unknown): value is CopilotMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages: unknown[] = Array.isArray(body.messages)
      ? body.messages
      : [];
    const messages = rawMessages
      .filter(isValidMessage)
      .slice(-MAX_MESSAGES)
      .map((message) => ({
        ...message,
        content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((message) => message.content.length > 0);

    const latestQuestion = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content;
    if (!latestQuestion)
      return NextResponse.json(
        { error: "Please enter a portfolio question." },
        { status: 400 },
      );

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        response: createFallbackResponse(latestQuestion),
        source: "demo",
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      reasoning: { effort: "low" },
      text: { format: responseFormat },
      instructions: `You are AlphaPilot, an educational investment copilot for self-directed retail investors. Explain portfolio composition, risks, diversification, and investment concepts in clear plain language. You are not a financial advisor.

Hard rules:
- Never recommend buying, selling, holding, rebalancing, or changing an allocation.
- Never give price targets, timing advice, or a prediction presented as fact.
- Do not claim to have live market, news, tax, or benchmark data unless it appears in the portfolio context.
- Focus on explanation, risk awareness, and concrete research questions.
- Keep the answer under 170 words. Mention uncertainty when relevant.
- Return only the requested JSON schema.

Portfolio context:
${buildPortfolioContext()}`,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })) as never,
    });

    const parsed = JSON.parse(response.output_text);
    return NextResponse.json({ response: parsed, source: "openai" });
  } catch (error) {
    console.error("Copilot request failed", error);
    return NextResponse.json(
      { error: "The copilot could not respond right now. Please try again." },
      { status: 500 },
    );
  }
}
