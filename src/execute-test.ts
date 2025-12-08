import { workflowData } from "./workflow/workflow-data";
import { executeWorkflow } from "./workflow/workflow-executor";
import {
  AIWorkflowEdgeType,
  AIWorkflowNodeType,
  WORKFLOW_CONTEXT,
} from "./workflow/workflow-types";

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
