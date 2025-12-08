import { TimelyGPTClient } from "./index";
import type { ExecuteCodeCallback } from "./workflow/workflow-types";
// Custom executeCodeCallback implementation
const customExecuteCodeCallback: ExecuteCodeCallback = async (
  toolName: string,
  args: Record<string, any>,
  functionCode: string
) => {
  console.log(`[Custom Callback] Executing tool: ${toolName}`);
  console.log(`[Custom Callback] Args:`, args);

  // Execute function with params
  const func = new Function("params", functionCode);
  const result = await Promise.resolve(func(args));

  console.log(`[Custom Callback] Result:`, result);

  return result;
};

async function main() {
  // Initialize client
  const client = new TimelyGPTClient({
    apiKey: process.env.TIMELY_API_KEY,
    baseURL: process.env.TIMELY_BASE_URL,
  });

  // Run workflow with custom options
  const result = await client.workflow.run(
    "01KBQ01TPRCPC6YVEMMXE35PY4", // workflow_id from sample data
    {
      startMessage: "귀여운 거북이 이미지를 생성해줘",
    },
    {
      addExecutionLog: (logs) => {},
      executeCodeCallback: customExecuteCodeCallback,
    }
  );

  console.log("=== Final Result ===");
  console.log(result);
}

main().catch(console.error);
