import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Allow up to 60 s on Vercel Pro / 10 s on Hobby (default would be 10 s which
// is often not enough for the Supabase queries + Anthropic first-token latency)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const { messages } = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("couple_id").eq("id", user.id).single();

    if (!profile?.couple_id) {
      return NextResponse.json({ error: "No household connected" }, { status: 400 });
    }

    const coupleId = profile.couple_id;
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      .toISOString().split("T")[0];

    const [{ data: txs }, { data: budgets }, { data: categories }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, date, category_id, merchant_name")
        .eq("couple_id", coupleId)
        .gte("date", sixMonthsAgo),
      supabase
        .from("budgets")
        .select("amount, period, category_id")
        .eq("couple_id", coupleId),
      supabase
        .from("categories")
        .select("id, name")
        .or(`is_default.eq.true,couple_id.eq.${coupleId}`),
    ]);

    const catMap = new Map((categories ?? []).map(c => [c.id, c.name]));

    // Aggregate net spending by month and category
    const monthly: Record<string, Record<string, number>> = {};
    for (const tx of (txs ?? [])) {
      const month = tx.date.slice(0, 7);
      const cat = tx.category_id ? (catMap.get(tx.category_id) ?? "Other") : "Uncategorized";
      if (!monthly[month]) monthly[month] = {};
      monthly[month][cat] = (monthly[month][cat] ?? 0) + tx.amount;
    }

    // Sort months and round values
    const monthlySummary = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cats]) => ({
        month,
        total: Math.round(Object.values(cats).reduce((s, a) => s + a, 0)),
        categories: Object.entries(cats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([cat, amt]) => ({ cat, amt: Math.round(amt) })),
      }));

    const budgetSummary = (budgets ?? []).map(b => {
      const monthly = b.period === "yearly" ? b.amount / 12
        : b.period === "weekly" ? (b.amount * 52) / 12 : b.amount;
      return {
        category: b.category_id ? (catMap.get(b.category_id) ?? "Unknown") : "Unknown",
        monthlyBudget: Math.round(monthly),
      };
    });

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const systemPrompt = `You are a friendly, helpful personal finance assistant for a couple using the Twogether budgeting app. You have access to their last 6 months of spending data.

Today's date: ${now.toISOString().split("T")[0]}
Current month: ${currentMonth}

Monthly spending summary (last 6 months):
${JSON.stringify(monthlySummary, null, 2)}

Monthly budget targets:
${JSON.stringify(budgetSummary, null, 2)}

Guidelines:
- Be conversational and friendly
- Use specific numbers from their data
- Keep responses concise (2-4 sentences unless they ask for detail)
- If they ask about something outside the data, be honest that you don't have that info
- Mention both people's perspective when relevant ("you both", "as a couple")`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = anthropic.messages.stream({
      model: "claude-3-5-haiku-latest",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (streamErr) {
          console.error("AI stream error:", streamErr);
          // Surface the failure as a visible message rather than silent "…"
          controller.enqueue(
            encoder.encode("Sorry, I couldn't get a response right now. Please try again.")
          );
        } finally {
          controller.close();
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
