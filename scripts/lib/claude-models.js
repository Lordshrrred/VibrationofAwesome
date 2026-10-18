// Keep migration settings beside the client, including raw-fetch consumers.
export function costControlledRequest(request) {
  if (!/^claude-(sonnet|haiku)-5-5$/.test(request.model || "")) return request;
  const body = { ...request };
  delete body.temperature;
  delete body.top_p;
  delete body.top_k;
  const tools = Boolean(body.tools?.length);
  body.thinking ??= { type: tools ? "adaptive" : body.model.includes("sonnet") ? "between_tools" : "disabled" };
  body.output_config = { effort: tools ? "low" : "medium", ...body.output_config };
  return body;
}

export function messageText(message) {
  if (["max_tokens", "refusal", "model_context_window_exceeded"].includes(message.stop_reason)) {
    throw new Error(`Incomplete Claude response: ${message.stop_reason}`);
  }
  return (message.content || []).filter(block => block.type === "text").map(block => block.text).join("\n").trim();
}
