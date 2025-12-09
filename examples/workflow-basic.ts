import { TimelyGPTClient } from "../src";

async function main() {
  const client = new TimelyGPTClient({
    apiKey: process.env.TIMELY_API_KEY, // TIMELY_API_KEY 입력
  });

  try {
    // Run workflow
    const result = await client.workflow.run(
      "workflow_id 입력",
      { message: "Hello workflow" }, // 워크플로우 실행 시작 파라미터
      {
        addExecutionLog: (log) => {
          // 워크플로우 실행 로그
          if (log.nodeType === "llm") {
            console.log(`[LLM] ${log.message}`);
          }
        },
      }
    );

    console.log("\nWorkflow completed");
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
