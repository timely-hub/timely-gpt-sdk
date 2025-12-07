import { TimelyGPTClient } from "../src";

async function main() {
  const client = new TimelyGPTClient({
    apiKey: "sdk_live_1234567890abcdef1234567890abcdef",
    baseURL: "https://hello.timelygpt.co.kr/api/v2/chat",
  });

  try {
    const response = await client.chat.completions.create({
      session_id: "session_" + Date.now(),
      messages: [
        { role: "user", content: "안녕하세요! 간단하게 인사해주세요." },
      ],
      chat_model_node: {
        model: "gpt-5.1",
        instructions: "당신은 친절한 AI 어시스턴트입니다.",
        output_type: "TEXT",
        use_all_built_in_tools: false,
      },
      locale: "ko",
      stream: false,
    });

    console.log("Response:", response);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
