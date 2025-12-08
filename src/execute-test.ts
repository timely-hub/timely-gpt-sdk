import { workflowData } from "./workflow-data";
import {
  AIWorkflowEdgeType,
  AIWorkflowNodeType,
  WORKFLOW_CONTEXT,
} from "./workflow-types";
import { executeWorkflow } from "./workflowExecutor";

async function main() {
  const data = workflowData?.data.workflow_data;
  const result = await executeWorkflow(
    data.nodes as unknown as AIWorkflowNodeType[],
    data.edges as unknown as AIWorkflowEdgeType[],
    WORKFLOW_CONTEXT,
    {
      startMessage: "귀여운 거북이 이미지를 생성해줘",
    }
  );

  console.log(result);
}

main().catch(console.error);
