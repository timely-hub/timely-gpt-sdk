import { setPath } from "../utils/object";
import { evaluateCEL } from "./evaluate-cel";
import { AIWorkflowNodeType } from "./workflow-types";
/**
 * CEL 평가를 위한 컨텍스트 생성
 */
function createCELContext(
  nodeOutputs: Map<string, any>,
  allNodes: AIWorkflowNodeType[],
  globalState?: Record<string, any>
): Record<string, any> {
  const context: Record<string, any> = {};

  // 모든 노드의 출력을 nodeLabel을 키로 추가
  for (const node of allNodes) {
    const output = nodeOutputs.get(node.id);
    if (output !== undefined) {
      context[node.data.label] = output;
    }
  }

  // state 추가
  if (globalState) {
    context.state = globalState;
  }

  return context;
}

export function resolveInputBindings(
  inputBindings: Record<string, string> | undefined,
  nodeOutputs: Map<string, any>,
  allNodes?: AIWorkflowNodeType[],
  globalState?: Record<string, any>
): Record<string, any> {
  const resolved: Record<string, any> = {};

  if (!inputBindings || !allNodes) {
    return resolved;
  }

  // CEL 컨텍스트 생성
  const celContext = createCELContext(nodeOutputs, allNodes, globalState);

  console.log("[resolveInputBindings] 입력 바인딩:", inputBindings);
  console.log("[resolveInputBindings] CEL 컨텍스트:", celContext);
  console.log(
    "[resolveInputBindings] nodeOutputs Map:",
    Array.from(nodeOutputs.entries()).map(([id, output]) => ({ id, output }))
  );

  for (const [targetKey, bindingPath] of Object.entries(inputBindings)) {
    try {
      // CEL로 바인딩 평가 (단순 경로 접근부터 복잡한 표현식까지 모두 처리)
      const value = evaluateCEL(bindingPath, celContext);

      // 타겟 키에 값 설정
      setPath(resolved, targetKey, value);

      console.log(`[바인딩 해석 성공] ${bindingPath} → ${targetKey}`, value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[바인딩 해석 실패] ${bindingPath}: ${message}`);
      continue;
    }
  }

  console.log("[resolveInputBindings] 최종 결과:", resolved);

  return resolved;
}
