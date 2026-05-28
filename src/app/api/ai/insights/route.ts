import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Model is read from the AI_MODEL env var at runtime so it can be updated in
// the Vercel dashboard without a code change or redeployment.
const AI_MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5-20251001";

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ insights: [] });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("couple_id").eq("id", user.id).single();

    if (!profile?.couple_id) return NextResponse.json({ insights: [] });
    const coupleId = profile.couple_id;

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      .toISOString().split("T")[0];

    const [{ data: txs }, { data: budgets }, { data: categories }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, date, category_id")
        .eq("couple_id", coupleId)
        .gte("date", threeMonthsAgo),
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

    // Aggregate net spending per month per category
    const monthly: Record<string, Record<string, number>> = {};
    for (const tx of (txs ?? [])) {
      const month = tx.date.slice(0, 7);
      const cat = tx.category_id ? (catMap.get(tx.category_id) ?? "Other") : "Uncategorized";
      if (!monthly[month]) monthly[month] = {};
      monthly[month][cat] = (monthly[month][cat] ?? 0) + tx.amount;
    }

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

    const currentSpend = monthly[currentMonth] ?? {};
    const prevSpend = monthly[prevMonth] ?? {};

    const currentTotal = Object.values(currentSpend).reduce((s, a) => s + a, 0);
    const prevTotal = Object.values(prevSpend).reduce((s, a) => s + a, 0);

    const budgetData = (budgets ?? []).map(b => {
      const monthly = b.period === "yearly" ? b.amount / 12
        : b.period === "weekly" ? (b.amount * 52) / 12 : b.amount;
      const catName = b.category_id ? (catMap.get(b.category_id) ?? "Unknown") : "Unknown";
      const spent = currentSpend[catName] ?? 0;
      return { category: catName, budget: Math.round(monthly), spent: Math.round(spent) };
    });

    const prompt = `You are a concise personal finance assistant for a couple.

Current month (${currentMonth}): $${Math.round(currentTotal)} total spent
Previous month (${prevMonth}): $${Math.round(prevTotal)} total spent

Current month spending by category: ${JSON.stringify(
  Object.entries(currentSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amt]) => `${cat}: $${Math.round(amt)}`),
  null, 0
)}

Budget vs actual this month: ${JSON.stringify(
  budgetData.filter(b => b.budget > 0).slice(0, 6),
  null, 0
)}

Generate exactly 3 short spending insights. Be specific with dollar amounts. Each insight is 1-2 sentences. Mix positive observations with actionable suggestions.

Return ONLY valid JSON with no extra text: {"insights":["insight1","insight2","insight3"]}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return NextResponse.json({ insights: parsed.insights ?? [] });
  } catch (err) {
    console.error("AI insights error:", err);
    return NextResponse.json({ insights: [] });
  }
}
