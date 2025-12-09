import { TimelyGPTClient } from "../src";

async function main() {
  const client = new TimelyGPTClient({
    apiKey: process.env.TIMELY_API_KEY, // TIMELY_API_KEY 입력
  });

  try {
    const stream = await client.chat.completions.create({
      session_id: "session_" + Date.now(),
      messages: [
        { role: "user", content: "프로그래밍에 대해 간단히 설명해주세요" },
      ],
      chat_model_node: {
        model: "gpt-5.1",
        instructions: "당신은 친절한 AI 어시스턴트입니다.",
      },
      stream: true,
      locale: "ko",
    });
    for await (const event of stream) {
      switch (event.type) {
        case "token":
          process.stdout.write(event.content);
          break;
        case "final_response":
          console.log("Session ID:", event.session_id);
          break;
        case "error":
          console.error("\n❌ Error:", event.error);
          break;
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
