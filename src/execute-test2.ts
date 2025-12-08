import { workflowData } from "./workflow-sample-data";
import { executeWorkflow } from "./workflow/workflow-executor";
import {
  AIWorkflowEdgeType,
  AIWorkflowNodeType,
  ExecuteCodeCallback,
  WorkflowContext,
} from "./workflow/workflow-types";

// 커스텀 executeCodeCallback 구현
const customExecuteCodeCallback: ExecuteCodeCallback = async (
  toolName: string,
  args: Record<string, any>,
  functionCode: string
) => {
  console.log(`[Custom Callback] Executing tool: ${toolName}`);
  console.log(`[Custom Callback] Args:`, args);
  console.log(`[Custom Callback] Function code length:`, functionCode.length);

  // params를 사용할 수 있도록 함수 실행
  const func = new Function("params", functionCode);
  const result = await Promise.resolve(func(args));

  console.log(`[Custom Callback] Result:`, result);

  return result;
};

// 커스텀 컨텍스트 생성 - Class 인스턴스 사용
const customContext = new WorkflowContext({
  addExecutionLog: (logs) => {
    console.log(`[${logs.nodeType}] ${logs.message}`);
  },
  executeCodeCallback: customExecuteCodeCallback,
});

async function main() {
  const data = workflowData?.data.workflow_data;
  const result = await executeWorkflow(
    data.nodes as unknown as AIWorkflowNodeType[],
    data.edges as unknown as AIWorkflowEdgeType[],
    customContext,
    {
      startMessage: "귀여운 거북이 이미지를 생성해줘",
    }
  );

  console.log("=== Final Result ===");
  console.log(result);
}

main().catch(console.error);
