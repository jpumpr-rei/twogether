// Tests for describeAIError (what the finance assistant tells the user when the AI call fails).
// Run with: npm test
//
// The real Anthropic SDK talks to a throwaway local server that impersonates the API, so each
// case produces the genuine error object the production route would catch. No real key involved.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { describeAIError, GENERIC_AI_ERROR } from "../src/lib/ai/errors.ts";

/** Starts a fake API; `respond(res)` decides what every request gets. */
function startFakeApi(respond) {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => respond(res));
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, port: server.address().port })
    )
  );
}

/** Runs the same call shape the chat route uses and returns whatever it throws. */
async function failureFrom(baseURL) {
  const client = new Anthropic({ apiKey: "test-key", baseURL, maxRetries: 0 });
  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16,
    messages: [{ role: "user", content: "hi" }],
  });
  let caught;
  try {
    for await (const event of stream) void event;
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "expected the request to fail");
  return caught;
}

async function describeFailureOf(respond) {
  const { server, port } = await startFakeApi(respond);
  try {
    return describeAIError(await failureFrom(`http://127.0.0.1:${port}`));
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

const apiError = (status, type, message) => (res) => {
  res.writeHead(status, { "content-type": "application/json", "request-id": "req_test" });
  res.end(JSON.stringify({ type: "error", error: { type, message } }));
};

const cases = [
  ["401 rejected key", apiError(401, "authentication_error", "invalid x-api-key"), /API key .*rejected \(401\)/],
  ["403 key not permitted", apiError(403, "permission_error", "not allowed"), /isn't allowed .*\(403\)/],
  ["404 model unavailable", apiError(404, "not_found_error", "model: claude-3-5-haiku-latest"), /model .*isn't available \(404\)/],
  [
    "400 empty credit balance (older API behavior)",
    apiError(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."),
    /out of credits/,
  ],
  ["402 billing_error", apiError(402, "billing_error", "billing problem"), /out of credits/],
  ["429 rate limited", apiError(429, "rate_limit_error", "slow down"), /rate-limiting/],
  ["529 overloaded", apiError(529, "overloaded_error", "Overloaded"), /busy or unreachable/],
  ["500 server error", apiError(500, "api_error", "Internal server error"), /busy or unreachable/],
  [
    "overloaded error arriving mid-stream (HTTP 200, no status on the error)",
    (res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n');
      res.end();
    },
    /busy or unreachable/,
  ],
];

for (const [name, respond, expected] of cases) {
  test(`assistant explains: ${name}`, async () => {
    const message = await describeFailureOf(respond);
    assert.match(message, expected);
    // Never leak the key or the raw API response into the chat bubble.
    assert.ok(!message.includes("test-key"), "message must not contain the API key");
    assert.ok(!message.includes("{"), "message must not contain raw JSON");
  });
}

test("assistant explains: connection refused", async () => {
  // Grab a free port, then close the server so nothing is listening on it.
  const { server, port } = await startFakeApi((res) => res.end());
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  const err = await failureFrom(`http://127.0.0.1:${port}`);
  assert.ok(err instanceof Anthropic.APIConnectionError);
  assert.match(describeAIError(err), /busy or unreachable/);
});

test("a 400 that isn't about billing stays generic", async () => {
  const message = await describeFailureOf(
    apiError(400, "invalid_request_error", "messages: roles must alternate")
  );
  assert.equal(message, GENERIC_AI_ERROR);
});

test("errors that didn't come from the Anthropic SDK stay generic", () => {
  assert.equal(describeAIError(new TypeError("boom")), GENERIC_AI_ERROR);
  assert.equal(describeAIError("a string"), GENERIC_AI_ERROR);
  assert.equal(describeAIError(undefined), GENERIC_AI_ERROR);
});
