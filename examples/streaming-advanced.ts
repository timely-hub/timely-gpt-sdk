import { StreamEvent, TimelyGPTClient } from "../src";

async function main() {
  const client = new TimelyGPTClient({
    apiKey: process.env.TIMELY_API_KEY, // TIMELY_API_KEY 입력
  });

  try {
    const stream = await client.chat.completions.create({
      session_id: "session_123",
      messages: [{ role: "user", content: "오늘 날씨는 어때?" }],
      chat_model_node: {
        model: "gpt-5.1",
        use_all_built_in_tools: true,
        output_type: "TEXT",
        instructions: "You are a helpful assistant.",
      },
      stream: true,
      thinking: true,
      locale: "ko",
    });

    let assistantMessage = "";
    let thinkingContent = "";

    for await (const event of stream) {
      handleStreamEvent(event, {
        onToken: (content) => {
          assistantMessage += content;
          process.stdout.write(content);
        },
        onThinking: (content) => {
          thinkingContent += content;
          console.log(`\n[Thinking] ${content}`);
        },
        onProgress: (content) => {
          console.log(`\n[Progress] ${content}`);
        },
        onToolResult: (result) => {
          console.log(`\n[Tool Result] ${result.name}: ${result.content}`);
        },
        onFinalResponse: (response) => {
          console.log("\n\n[Final Response]");
          console.log("Message:", response.message);
        },
        onError: (error) => {
          console.error("\n[Error]", error);
        },
      });
    }

    console.log("\n\nStream completed!");
  } catch (error) {
    console.error("Error:", error);
  }
}

interface StreamEventHandlers {
  onToken?: (content: string) => void;
  onThinking?: (content: string) => void;
  onProgress?: (content: string) => void;
  onToolResult?: (result: {
    name: string;
    content: string;
    tool_call_id: string;
  }) => void;
  onStructuredOutput?: (output: unknown) => void;
  onToolCallRequired?: (data: {
    session_id: string;
    tool_calls: Array<{
      tool_call_id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
    configurable: {
      thread_id: string;
      checkpoint_ns: string;
      checkpoint_id: string;
    };
  }) => void;
  onFinalResponse?: (response: {
    session_id: string;
    message: string;
    thinking: string;
    tool_results?: Array<Record<string, unknown>>;
  }) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

function handleStreamEvent(
  event: StreamEvent,
  handlers: StreamEventHandlers
): void {
  switch (event.type) {
    case "token":
      handlers.onToken?.(event.content);
      break;
    case "thinking":
      handlers.onThinking?.(event.content);
      break;
    case "progress":
      handlers.onProgress?.(event.content);
      break;
    case "tool_result":
      handlers.onToolResult?.({
        name: event.name,
        content: event.content,
        tool_call_id: event.tool_call_id,
      });
      break;
    case "structured_output":
      handlers.onStructuredOutput?.(event.output);
      break;
    case "tool_call_required":
      handlers.onToolCallRequired?.({
        session_id: event.session_id,
        tool_calls: event.tool_calls,
        configurable: event.configurable,
      });
      break;
    case "final_response":
      handlers.onFinalResponse?.({
        session_id: event.session_id,
        message: event.message,
        thinking: event.thinking,
        tool_results: event.tool_results,
      });
      break;
    case "end":
      handlers.onEnd?.();
      break;
    case "error":
      handlers.onError?.(event.error);
      break;
  }
}

main();
