import Anthropic from "@anthropic-ai/sdk";

/** Shown when a failure isn't one we can say anything more specific about. */
export const GENERIC_AI_ERROR = "Sorry, I couldn't get a response right now. Please try again.";

/**
 * Turns a failure from the Anthropic SDK into a message that says what actually went wrong.
 *
 * Every failure used to produce the same sentence, so a rejected API key (which no amount of
 * retrying fixes) looked identical to a momentary hiccup. Problems only the app's owner can
 * fix are now called out; transient ones stay short and say to retry.
 *
 * Keyed on `status` and `type`: HTTP errors carry both, an error event that arrives mid-stream
 * carries only the type, and a network failure carries neither.
 */
export function describeAIError(err: unknown): string {
  if (!(err instanceof Anthropic.APIError)) return GENERIC_AI_ERROR;

  const { status, type } = err;

  if (status === 401 || type === "authentication_error") {
    return "I can't reach the AI service: the API key this app uses was rejected (401). The key needs to be replaced in the app's settings.";
  }
  if (status === 403 || type === "permission_error") {
    return "I can't reach the AI service: the API key this app uses isn't allowed to make this request (403). Check the key's permissions in the Anthropic console.";
  }
  if (status === 404 || type === "not_found_error") {
    return "I can't reach the AI service: the AI model this app is set to use isn't available (404). The model name needs to be updated.";
  }
  // An empty balance arrives as a billing_error (402), or on older API behavior as a 400 whose
  // message mentions the credit balance.
  if (status === 402 || type === "billing_error" || /credit balance/i.test(err.message)) {
    return "I can't reach the AI service: the Anthropic account behind this app is out of credits. Add credits under Plans & Billing in the Anthropic console, then try again.";
  }
  if (status === 429 || type === "rate_limit_error") {
    return "The AI service is rate-limiting this app right now. Please try again in a minute.";
  }
  if (
    err instanceof Anthropic.APIConnectionError ||
    type === "overloaded_error" ||
    type === "timeout_error" ||
    type === "api_error" ||
    (status !== undefined && status >= 500)
  ) {
    return "The AI service is busy or unreachable right now. Please try again in a moment.";
  }

  return GENERIC_AI_ERROR;
}
