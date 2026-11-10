import type Anthropic from "@anthropic-ai/sdk";

export type ToolOutcome = { content: string; isError?: boolean };

export type ChatLoopOptions = {
  anthropic: Anthropic;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
  /** Called with each piece of the reply as it arrives. */
  onText: (text: string) => void;
  maxTokens?: number;
  /** How many rounds of tool calls the model gets before it has to answer with what it has. */
  maxToolRounds?: number;
};

/**
 * Runs one reply: stream the model's answer, run any tools it asks for, hand the results back, and
 * repeat until it answers in plain text.
 *
 * This is a manual loop on the SDK's stable streaming API rather than its beta tool runner, which
 * keeps us off a beta surface and lets us decide exactly what reaches the user between rounds.
 * Throws on API failures; the caller reports them.
 */
export async function runChatLoop(options: ChatLoopOptions): Promise<void> {
  const { anthropic, model, system, tools, runTool, onText, maxTokens = 4096, maxToolRounds = 5 } = options;

  // Tool calls and results live only for this reply. The client sends just the visible text of earlier
  // turns, so a follow-up question looks things up again instead of trusting stale numbers.
  const history: Anthropic.MessageParam[] = [...options.messages];

  // The model often says a line like "Let me check" before calling a tool; keep it from running into
  // the answer that follows.
  let breakBeforeNextText = false;

  for (let round = 0; round <= maxToolRounds; round++) {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      messages: history,
      tools,
      // On the last round, forbid more tool calls so the reply has to be an answer. (The tool
      // definitions stay in the request: the API rejects tool_use blocks in history without them.)
      ...(round === maxToolRounds ? { tool_choice: { type: "none" as const } } : {}),
    });

    let wroteText = false;
    stream.on("text", (delta) => {
      if (breakBeforeNextText) {
        breakBeforeNextText = false;
        onText("\n\n");
      }
      wroteText = true;
      onText(delta);
    });

    const message = await stream.finalMessage();

    // Only a turn that ended by asking for tools continues. In particular never run tools after
    // max_tokens or a refusal, which can cut a tool call off mid-input.
    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) return;

    // Replay the assistant turn exactly as received (including any thinking blocks).
    history.push({ role: "assistant", content: message.content });

    const results = await Promise.all(
      toolUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
        try {
          const outcome = await runTool(use.name, use.input);
          return {
            type: "tool_result",
            tool_use_id: use.id,
            content: outcome.content,
            ...(outcome.isError ? { is_error: true } : {}),
          };
        } catch (err) {
          console.error(`AI tool "${use.name}" failed:`, err);
          return {
            type: "tool_result",
            tool_use_id: use.id,
            content: "The lookup failed. Tell the user you couldn't get that information right now.",
            is_error: true,
          };
        }
      })
    );
    history.push({ role: "user", content: results });

    if (wroteText) breakBeforeNextText = true;
  }
}
