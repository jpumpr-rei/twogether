import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { describeAIError } from "@/lib/ai/errors";
import { runChatLoop } from "@/lib/ai/chatLoop";
import { AI_TOOLS, runAITool, type ToolDb } from "@/lib/ai/tools";
import { buildSystemPrompt, parseChatRequest } from "@/lib/ai/chatRequest";

// An answer can take several round trips (the model, then a database lookup, then the model again),
// so allow the full 60 s that the Hobby plan permits.
export const maxDuration = 60;

// Model is read from the AI_MODEL env var at runtime so it can be updated in
// the Vercel dashboard without a code change or redeployment.
const AI_MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5-20251001";

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("couple_id").eq("id", user.id).single();

    if (!profile?.couple_id) {
      return NextResponse.json({ error: "No household connected" }, { status: 400 });
    }
    const coupleId = profile.couple_id;

    const { messages, today } = parseChatRequest(
      await req.json().catch(() => null),
      new Date().toISOString().split("T")[0]
    );
    if (messages.length === 0) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    // Transactions themselves are looked up on demand by the assistant's tools. Here we only gather
    // what it needs up front: the budgets, the category names, and how far back the data goes.
    const [{ data: budgets }, { data: categories }, { data: earliest }, { data: latest }] =
      await Promise.all([
        supabase
          .from("budgets")
          .select("amount, period, category_id")
          .eq("couple_id", coupleId),
        supabase
          .from("categories")
          .select("id, name")
          .or(`is_default.eq.true,couple_id.eq.${coupleId}`)
          .order("name"),
        supabase
          .from("transactions")
          .select("date")
          .eq("couple_id", coupleId)
          .order("date", { ascending: true })
          .limit(1),
        supabase
          .from("transactions")
          .select("date")
          .eq("couple_id", coupleId)
          .order("date", { ascending: false })
          .limit(1),
      ]);

    const catMap = new Map((categories ?? []).map(c => [c.id, c.name]));

    const budgetSummary = (budgets ?? []).map(b => {
      const monthly = b.period === "yearly" ? b.amount / 12
        : b.period === "weekly" ? (b.amount * 52) / 12 : b.amount;
      return {
        category: b.category_id ? (catMap.get(b.category_id) ?? "Unknown") : "Unknown",
        monthlyBudget: Math.round(monthly),
      };
    });

    const dataRange = {
      earliest: earliest?.[0]?.date ?? null,
      latest: latest?.[0]?.date ?? null,
    };

    const systemPrompt = buildSystemPrompt({
      today,
      dataRange,
      categories: [...catMap.values()],
      budgets: budgetSummary,
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const toolContext = { db: supabase as unknown as ToolDb, coupleId, dataRange };

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let wroteText = false;
        // The browser may have gone away mid-answer; writing to a closed stream must not crash us.
        const send = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            /* client disconnected */
          }
        };

        try {
          await runChatLoop({
            anthropic,
            model: AI_MODEL,
            system: systemPrompt,
            messages,
            tools: AI_TOOLS,
            runTool: (name, input) => runAITool(name, input, toolContext),
            onText: (text) => {
              wroteText = true;
              send(text);
            },
          });
        } catch (streamErr) {
          console.error("AI stream error:", streamErr);
          // Surface the failure as a visible message rather than silent "…", saying what
          // actually went wrong (rejected key, no credits, busy…) instead of one line for all.
          send((wroteText ? "\n\n" : "") + describeAIError(streamErr));
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
