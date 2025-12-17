// Note: dotenv/config removed for browser compatibility
import { evaluateCEL, evaluateCondition } from "./evaluate-cel";
import { resolveInputBindings } from "./resolve-input-bindings";
import type {
  AIWorkflowEdgeType,
  AIWorkflowNodeType,
  WorkflowContextType,
} from "./workflow-types";
type LLMCompletionRequest = Record<string, any>;

// Tool 노드 실행
const { executeCode } = {
  executeCode: async (
    code: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; result: any; error: string | null }> => {
    try {
      const func = new Function("params", code);
      const result = await Promise.resolve(func(params));
      return {
        success: true,
        result,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
/**
 * Start 노드 실행
 */
async function executeStartNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  initialInputs?: Record<string, any>
): Promise<any> {
  const output = {
    type: node.type,
    timestamp: Date.now(),
    // Start 노드의 초기 입력 데이터
    ...initialInputs,
  };
  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "start",
      input: initialInputs,
    },
    "Start 노드 실행 시작"
  );
  return output;
}

/**
 * Tool 노드 실행
 */
async function executeToolNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[]
): Promise<any> {
  // 입력 바인딩 해석
  const toolNodeData = node.data;
  const inputs = resolveInputBindings(
    toolNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );

  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "start",
      input: inputs,
    },
    "Tool 노드 실행 시작"
  );

  let result: any = null;

  try {
    const nodeData = (node as any).data.nodeData;

    if (!nodeData) {
      throw new Error("Tool 노드 데이터가 없습니다");
    }

    if (nodeData.type === "custom") {
      const functionCode = nodeData.tool.function_body ?? "";
      const toolName = nodeData.tool.name || nodeData.tool.id || "unknown";

      // context에서 콜백을 가져와서 사용, 없으면 기본 executeCode 사용
      if (context.executeCodeCallback) {
        result = await context.executeCodeCallback(
          toolName,
          inputs,
          functionCode
        );
      } else {
        const executionResult = await executeCode(functionCode, inputs);

        // Custom tool 실행 결과 검증
        if (!executionResult.success) {
          throw new Error(
            executionResult.error || "Custom tool 실행 실패 (알 수 없는 오류)"
          );
        }

        result = executionResult.result ?? executionResult;
      }
    } else if (nodeData.type === "built-in") {
      // Built-in tool 실행을 위한 fetch 직접 호출
      const accessToken = context.getAccessToken
        ? await context.getAccessToken()
        : "master";
      const response = await fetch(
        `${context.baseURL}/built-in-tool-node/${nodeData.tool.id}/invoke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ args: inputs }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || errorData.error || response.statusText;
        throw new Error(`Built-in tool 실행 실패: ${errorMessage}`);
      }

      const data = await response.json();

      // API 응답에서 에러 체크
      if (data.error) {
        throw new Error(`Built-in tool 실행 실패: ${data.error}`);
      }

      const output = data.output;
      result = output;
    } else if (nodeData.type === "mcp") {
      // TODO: MCP 도구 실행
      throw new Error("MCP 도구 실행은 아직 지원되지 않습니다");
    }

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "done",
        output: result,
      },
      "Tool 노드 실행 완료"
    );

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * LLM 노드 실행 (스트리밍)
 */
async function executeLlmNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  edges: AIWorkflowEdgeType[],
  allNodes: AIWorkflowNodeType[]
): Promise<any> {
  // 입력 바인딩 해석
  const llmNodeData = (node as any).data;
  let inputs = resolveInputBindings(
    llmNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );

  // 입력 바인딩이 없거나 비어있으면, 이전 노드의 출력을 자동으로 사용
  if (!llmNodeData.inputBindings || Object.keys(inputs).length === 0) {
    const incomingEdges = edges.filter(
      (e: AIWorkflowEdgeType) => e.target === node.id
    );
    if (incomingEdges.length > 0) {
      // 첫 번째 이전 노드의 출력 사용
      const sourceNodeId = incomingEdges[0].source;
      const sourceOutput =
        context.state.execution.nodeOutputs.get(sourceNodeId);
      if (sourceOutput) {
        // Transformer의 출력이 string이면 그대로 사용, 아니면 전체 객체 사용
        if (typeof sourceOutput === "string") {
          inputs = { userMessage: sourceOutput };
        } else {
          inputs = sourceOutput;
        }
      }
    }
  }

  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "start",
      input: inputs,
    },
    "LLM 노드 실행 시작"
  );
  try {
    const nodeData = (node as any).data.nodeData;
    const chatModelNodeId = nodeData.id;

    const sessionId = `workflow-${node.id}-${Date.now()}`;
    const allMessages: any[] = [];
    let parsedOutput: any = null; // JSON 모드일 때 parsed 결과 저장

    // 재귀적으로 LLM 호출 (tool_call_required 처리) - 스트리밍
    const processStream = async (
      requestBody: LLMCompletionRequest,
      checkpointId: string | null = null,
      baseURL: string
    ): Promise<void> => {
      const accessToken = context.getAccessToken
        ? await context.getAccessToken()
        : "master";

      const response = await fetch(`${baseURL}/llm-completion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...requestBody,
          checkpoint_id: checkpointId,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let accumulatedMessage = "";
      let accumulatedThinking = "";
      let hasFinalResponse = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const data = line.slice(6);
          try {
            const event: any = JSON.parse(data);

            context.onNodeResult?.(
              node.id,
              node.type,
              {
                type: "stream",
                data: event,
              },
              "LLM 노드 스트리밍 이벤트"
            );

            switch (event.type) {
              case "start":
                break;

              case "token":
                accumulatedMessage += event.content;
                break;

              case "thinking":
                accumulatedThinking += event.content;
                break;

              case "progress":
                break;

              case "final_response":
                hasFinalResponse = true;
                allMessages.push({
                  role: "assistant",
                  content: event.message,
                });

                // JSON 모드일 때 parsed 저장
                if (event.parsed) {
                  parsedOutput = event.parsed;
                }
                break;

              case "end":
                // final_response가 없었을 때만 메시지 추가
                if (!hasFinalResponse && accumulatedMessage) {
                  allMessages.push({
                    role: "assistant",
                    content: accumulatedMessage,
                  });
                }
                break;

              case "error":
                throw new Error(event.message || event.error);

              case "tool_call_required":
                // 도구 실행
                const toolResults = await Promise.all(
                  event.tool_calls.map(async (toolCall: any) => {
                    let result: string;

                    // 도구 타입별 실행
                    const tool = nodeData.tools?.find(
                      (t: any) => t.name === toolCall.name
                    );

                    if (!tool) {
                      result = JSON.stringify({
                        error: "도구를 찾을 수 없습니다",
                      });
                    } else if (tool.type === "custom") {
                      const execResult = await executeCode(
                        tool.functionCode || "",
                        toolCall.args
                      );

                      // Custom tool 실행 결과 검증
                      if (!execResult.success) {
                        result = JSON.stringify({
                          error: execResult.error || "도구 실행 실패",
                        });
                      } else {
                        result = JSON.stringify(execResult);
                      }
                    } else if (tool.type === "built-in") {
                      const accessToken = context.getAccessToken
                        ? await context.getAccessToken()
                        : "master";
                      const builtInResponse = await fetch(
                        `${context.baseURL}/built-in-tool-node/${tool.id}/invoke`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                          },
                          body: JSON.stringify({ args: toolCall.args }),
                        }
                      );

                      if (!builtInResponse.ok) {
                        result = JSON.stringify({
                          error: "Built-in tool 실행 실패",
                        });
                      } else {
                        const builtInData = await builtInResponse.json();
                        result = builtInData.data.output;
                      }
                    } else {
                      result = JSON.stringify({
                        error: "지원하지 않는 도구 타입",
                      });
                    }

                    return {
                      role: "tool" as const,
                      name: toolCall.name,
                      tool_call_id: toolCall.tool_call_id,
                      content: result,
                    };
                  })
                );

                // 재귀 호출
                await processStream(
                  {
                    ...requestBody,
                    messages: toolResults,
                  },
                  event.configurable.checkpoint_id,
                  context.baseURL || ""
                );
                return; // 재귀 호출 후 종료

              default:
                // 알 수 없는 이벤트 타입은 무시
                break;
            }
          } catch (parseError) {
            console.error("[Stream Parse Error]", parseError);
          }
        }
      }
    };

    // 초기 요청
    const initialRequest: LLMCompletionRequest = {
      session_id: sessionId,
      chat_model_node_id:
        chatModelNodeId && !nodeData ? chatModelNodeId : undefined,
      chat_model_node: nodeData,
      files: [],
      locale: "ko",
      user_location: null,
      use_all_built_in_tools: false,
      use_background_summarize: false,
      never_use_history: true,
      checkpoint_id: null,

      stream: true,
      messages: [
        {
          role: "user",
          content: inputs.userMessage || JSON.stringify(inputs),
        },
      ],
    };

    await processStream(initialRequest, null, context.baseURL || "");

    // JSON 모드일 때는 parsed 결과를, TEXT 모드일 때는 메시지 결과를 반환
    let result: any;
    if (nodeData.output_type === "JSON" && parsedOutput) {
      // JSON 모드: parsed 객체를 그대로 반환
      result = parsedOutput;
    } else {
      // TEXT 모드: 기존 형식 유지
      result = {
        response:
          allMessages.length > 0
            ? allMessages[allMessages.length - 1].content
            : null,
      };
    }

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "done",
        output: result,
      },
      "LLM 노드 실행 완료"
    );

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * AutoTransformer 노드 실행
 */
async function executeTransformerNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[]
): Promise<any> {
  try {
    const nodeData = node.data.nodeData;

    if (!nodeData || !nodeData.userRequest) {
      throw new Error("Transformer 노드의 userRequest가 없습니다");
    }

    // 이전 노드들 찾기 (여러 개 가능)
    const incomingEdges = edges.filter((e) => e.target === node.id);

    if (incomingEdges.length === 0) {
      throw new Error("Transformer 노드의 이전 노드를 찾을 수 없습니다");
    }

    // 이전 노드들의 출력 수집 (sources 배열 구성)
    const sources: Array<{
      sourceOutput: any;
      sourceNode: { name: string; description: string };
    }> = [];

    for (const edge of incomingEdges) {
      const sourceNode = allNodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      const sourceOutput = context.state.execution.nodeOutputs.get(
        sourceNode.id
      );
      if (!sourceOutput) {
        throw new Error(
          `이전 노드(${sourceNode.id})의 출력을 찾을 수 없습니다`
        );
      }

      sources.push({
        sourceOutput,
        sourceNode: {
          name: sourceNode.data.label || sourceNode.type || "Unknown",
          description:
            (sourceNode.data as any).nodeData?.description || "Source node",
        },
      });
    }

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "start",
        inputs: sources,
        inputsCount: sources.length,
      },
      "Transformer 노드 실행 시작"
    );

    // 다음 노드 찾기 (targetNode)
    const outgoingEdge = edges.find((e) => e.source === node.id);
    const targetNode = outgoingEdge
      ? allNodes.find((n) => n.id === outgoingEdge.target)
      : null;

    if (!targetNode) {
      throw new Error("Transformer 노드의 다음 노드를 찾을 수 없습니다");
    }

    // 타겟 노드의 입력 스키마 추출
    const targetInputType = extractInputSchema(targetNode);

    // Auto-Transformer API 호출
    const accessToken = context.getAccessToken
      ? await context.getAccessToken()
      : "master";
    const response = await fetch(
      `${context.baseURL}/ai-workflow/helper-node/auto-transformer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userRequest: nodeData.userRequest,
          sources: sources,
          targetNode: {
            name: targetNode.data.label || targetNode.type,
            description:
              (targetNode.data as any).nodeData?.description || "Target node",
          },
          targetInputType,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Auto-Transformer API 실행 실패: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.data.result;

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "done",
        output: result,
      },
      "Transformer 노드 실행 완료"
    );
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * 노드의 입력 스키마 추출
 */
function extractInputSchema(node: AIWorkflowNodeType): any {
  const nodeType = node.type;
  const nodeData = (node as any).data.nodeData;

  switch (nodeType) {
    case "tool":
      // Tool 노드의 input_schema
      return nodeData?.tool?.input_schema || "string";

    case "llm":
      // LLM 노드는 일반적으로 string (userMessage)
      return "string";

    case "transformer":
      // Transformer 노드는 다음 노드의 스키마를 따름
      return "string";

    case "end":
      // End 노드의 output_schema
      return nodeData?.output_schema || "string";

    default:
      return "string";
  }
}

/**
 * End 노드 실행
 */
async function executeEndNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  edges: AIWorkflowEdgeType[],
  allNodes: AIWorkflowNodeType[]
): Promise<any> {
  const endNodeData = node.data;
  const nodeData = endNodeData.nodeData;

  // 입력 바인딩 해석
  let inputs = resolveInputBindings(
    endNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );

  // 입력 바인딩이 없거나 비어있으면, 이전 노드의 출력을 자동으로 사용
  if (!endNodeData.inputBindings || Object.keys(inputs).length === 0) {
    const incomingEdges = edges.filter(
      (e: AIWorkflowEdgeType) => e.target === node.id
    );
    if (incomingEdges.length > 0) {
      // 첫 번째 이전 노드의 출력 사용
      const sourceNodeId = incomingEdges[0].source;
      const sourceOutput =
        context.state.execution.nodeOutputs.get(sourceNodeId);
      if (sourceOutput) {
        // TEXT 모드면 message로, JSON 모드면 data로 자동 매핑
        if (nodeData.output_type === "TEXT") {
          inputs = {
            message:
              typeof sourceOutput === "string"
                ? sourceOutput
                : sourceOutput.lastMessage?.content ||
                  JSON.stringify(sourceOutput),
          };
        } else {
          // JSON 모드
          inputs = { data: sourceOutput };
        }
      }
    }
  }

  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "start",
      input: inputs,
    },
    "End 노드 실행 시작"
  );
  // output_type에 따른 최종 결과 구성
  let finalOutput: any;

  if (nodeData.output_type === "JSON") {
    // JSON 모드: inputs를 그대로 반환 (스키마에 맞춰진 구조)
    finalOutput = inputs;

    // 출력 스키마 검증 (선택사항)
    if (nodeData.output_schema) {
      // TODO: JSON Schema 검증 추가
      // const schema = nodeData.output_schema;
      // validateJsonSchema(finalOutput, schema);
    }
  } else {
    // TEXT 모드: message 필드를 문자열로 반환
    finalOutput = {
      message: inputs.message || JSON.stringify(inputs),
      timestamp: Date.now(),
    };
  }

  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "complete",
      output: finalOutput,
    },
    "End 노드 실행 완료"
  );

  return finalOutput;
}

/**
 * 노드 실행
 */
/**
 * RAG 노드 실행
 */
async function executeRAGNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  edges: AIWorkflowEdgeType[],
  allNodes: AIWorkflowNodeType[]
): Promise<any> {
  const ragNodeData = node.data;
  const nodeData = ragNodeData.nodeData;

  // 1. 입력 바인딩 해석
  let inputs = resolveInputBindings(
    ragNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );

  // 2. Auto-binding (입력 바인딩이 없으면 이전 노드 출력 자동 사용)
  if (!ragNodeData.inputBindings || Object.keys(inputs).length === 0) {
    const incomingEdges = edges.filter(
      (e: AIWorkflowEdgeType) => e.target === node.id
    );
    if (incomingEdges.length > 0) {
      const sourceNodeId = incomingEdges[0].source;
      const sourceOutput =
        context.state.execution.nodeOutputs.get(sourceNodeId);
      if (sourceOutput) {
        // 이전 노드 출력을 query로 사용
        inputs =
          typeof sourceOutput === "string"
            ? { query: sourceOutput }
            : {
                query:
                  sourceOutput.response ||
                  sourceOutput.userMessage ||
                  JSON.stringify(sourceOutput),
              };
      }
    }
  }

  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "start",
      input: inputs,
    },
    "RAG 노드 실행 시작"
  );
  try {
    // 4. Storage ID 확인
    if (!nodeData?.storage_id) {
      throw new Error("RAG Storage가 선택되지 않았습니다");
    }

    // 5. 검색 쿼리 확인
    const query = inputs.query;
    if (!query || typeof query !== "string") {
      throw new Error("검색 쿼리가 없거나 유효하지 않습니다");
    }

    // 6. RAG Storage Query API 호출
    const requestBody: any = {
      query,
      top_k: nodeData.top_k ?? 5,
      search_type: nodeData.search_type ?? "similarity",
    };

    // 옵션 파라미터 추가
    if (nodeData.fileNames && nodeData.fileNames.length > 0) {
      requestBody.fileNames = nodeData.fileNames;
    }

    if (nodeData.search_type === "mmr" && nodeData.mmr_lambda !== undefined) {
      requestBody.mmr_lambda = nodeData.mmr_lambda;
    }

    if (nodeData.filter_metadata) {
      requestBody.filter_metadata = nodeData.filter_metadata;
    }

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "search_start",
        data: {
          storage_id: nodeData.storage_id,
          query,
          top_k: nodeData.top_k,
        },
      },
      "RAG 노드 검색 시작"
    );

    const accessToken = context.getAccessToken
      ? await context.getAccessToken()
      : "master";
    const response = await fetch(
      `${context.baseURL}/ai-workflow/rag-storage-node/${nodeData.storage_id}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`RAG 검색 실패: ${response.statusText}`);
    }

    const data = await response.json();

    // API 응답에서 result 추출 (문자열 형태)
    const result = data.data?.context || data.context || "";

    context.onNodeResult?.(node.id, node.type, {
      type: "search_complete",
      data: {
        result_length: result.length,
      },
    });

    context.onNodeResult?.(node.id, node.type, {
      type: "complete",
      result,
    });

    // 결과를 문자열로 반환
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * State 노드 실행
 * 워크플로우 전역 상태를 설정
 */
async function executeStateNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[]
): Promise<Record<string, any>> {
  const stateUpdates = node.data.nodeData?.stateUpdates || [];
  const nodeOutputs = context.state.execution.nodeOutputs;
  const globalState = context.state.execution.globalState;

  // CEL 컨텍스트 생성
  const celContext: Record<string, any> = {};
  for (const n of allNodes) {
    const output = nodeOutputs.get(n.id);
    if (output !== undefined) {
      celContext[n.data.label] = output;
    }
  }
  // state를 객체로 변환하여 추가
  const stateObject: Record<string, any> = {};
  for (const [key, value] of globalState.entries()) {
    stateObject[key] = value;
  }
  celContext.state = stateObject;

  for (const update of stateUpdates) {
    if (!update.key) {
      console.warn(`[State 노드] 상태 키가 비어있어 건너뜁니다`);
      continue;
    }

    let value: any;

    // 바인딩이 있으면 CEL로 평가
    if (update.binding) {
      try {
        value = evaluateCEL(update.binding, celContext);
      } catch (error) {
        console.warn(`[State 노드] 바인딩 평가 실패: ${update.binding}`, error);
        continue;
      }
    } else {
      // 직접 값 사용
      value = update.value;
    }

    // 전역 상태에 저장
    globalState.set(update.key, value);

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "state_update",
        data: {
          key: update.key,
          value,
        },
      },
      "State 노드 상태 업데이트"
    );
  }

  // 설정된 상태를 객체로 반환 (디버깅용)
  const result: Record<string, any> = {};
  for (const [key, value] of globalState.entries()) {
    result[key] = value;
  }
  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "done",
      output: result,
    },
    "State 노드 실행 완료"
  );
  return result;
}

/**
 * Loop 내부 노드 그래프 실행
 * 시작 노드부터 Loop 끝 핸들까지 엣지를 따라 순회하며 실행
 */
async function executeInternalLoopGraph(
  startNodeId: string,
  loopEndHandleId: string,
  loopNodeId: string,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[]
): Promise<void> {
  const visited = new Set<string>();
  let currentNodeId = startNodeId;

  while (currentNodeId) {
    // 무한 루프 방지
    if (visited.has(currentNodeId)) {
      throw new Error(`Loop 내부에서 순환 참조 발견: ${currentNodeId}`);
    }
    visited.add(currentNodeId);

    // 현재 노드 찾기
    const currentNode = allNodes.find((n) => n.id === currentNodeId);
    if (!currentNode) {
      throw new Error(`노드를 찾을 수 없음: ${currentNodeId}`);
    }

    // 노드 실행
    const output = await executeNode(
      currentNode,
      context,
      allNodes,
      edges,
      undefined
    );

    // 출력 저장
    context.state.execution.nodeOutputs.set(currentNodeId, output);

    // 다음 노드 찾기
    // 1. Loop 끝 핸들로 연결되는지 확인
    const toLoopEndEdge = edges.find(
      (e) =>
        e.source === currentNodeId &&
        e.target === loopNodeId &&
        e.targetHandle === loopEndHandleId
    );

    if (toLoopEndEdge) {
      // Loop 끝에 도달
      break;
    }

    // 2. 일반 엣지 찾기
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      throw new Error(
        `Loop 내부 노드 ${currentNodeId}에서 Loop 끝으로 연결되지 않음`
      );
    }

    // Condition 노드의 경우 selectedHandleId로 다음 노드 결정
    if (currentNode.type === "condition" && output.selectedHandleId) {
      const nextEdge = outgoingEdges.find(
        (e) => e.sourceHandle === output.selectedHandleId
      );
      if (!nextEdge) {
        throw new Error(
          `Condition 노드 ${currentNodeId}의 출력 핸들 ${output.selectedHandleId}에 연결된 엣지 없음`
        );
      }
      currentNodeId = nextEdge.target;
    } else {
      // 일반 노드는 첫 번째 엣지 따라감
      currentNodeId = outgoingEdges[0].target;
    }
  }
}

/**
 * Loop 노드 실행
 * Loop 내부 노드들을 반복 실행하며, exit condition이 true가 되거나
 * maxIterations에 도달하면 종료합니다.
 */
async function executeLoopNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[]
): Promise<{ selectedHandleId: string; iterations: number }> {
  const loopNodeData = (node as any).data;
  const {
    exitCondition,
    maxIterations = 10,
    loopStartHandleId,
    loopEndHandleId,
  } = loopNodeData.nodeData || {};

  const actualLoopStartHandleId = loopStartHandleId || `${node.id}-loop-start`;
  const actualLoopEndHandleId = loopEndHandleId || `${node.id}-loop-end`;

  context.onNodeResult?.(node.id, node.type, {
    type: "start",
    data: {
      maxIterations,
    },
  });

  // Loop 내부 시작 핸들에서 나가는 엣지 찾기
  const loopStartEdge = edges.find(
    (e) => e.source === node.id && e.sourceHandle === actualLoopStartHandleId
  );

  if (!loopStartEdge) {
    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "error",
        error: "Loop 내부 시작 핸들에 연결된 노드가 없습니다",
      },
      "Loop 노드 실행 실패(Loop 내부 시작 핸들에 연결된 노드가 없습니다)"
    );
    return { selectedHandleId: `${node.id}-exit`, iterations: 0 };
  }

  // Loop 내부 첫 노드 찾기
  const firstInternalNodeId = loopStartEdge.target;

  let iteration = 0;

  for (iteration = 1; iteration <= maxIterations; iteration++) {
    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "iteration_start",
        data: {
          iteration,
          maxIterations,
        },
      },
      `Loop 노드 반복 시작 - ${iteration} / ${maxIterations}`
    );

    // Loop 내부 노드 그래프 실행
    try {
      await executeInternalLoopGraph(
        firstInternalNodeId,
        actualLoopEndHandleId,
        node.id,
        context,
        allNodes,
        edges
      );

      context.onNodeResult?.(
        node.id,
        node.type,
        {
          type: "iteration_done",
          data: {
            iteration,
            maxIterations,
          },
        },
        "Loop 노드 반복 완료"
      );
    } catch (error) {
      throw error;
    }

    // Exit condition 체크
    if (exitCondition?.expression) {
      // 평가 컨텍스트 구성
      const evaluationContext: Record<string, any> = {};
      const nodeOutputs = context.state.execution.nodeOutputs;
      const globalState = context.state.execution.globalState;

      // 모든 이전 노드의 출력을 context에 추가
      for (const [nodeId, output] of nodeOutputs.entries()) {
        const sourceNode = allNodes.find((n) => n.id === nodeId);
        if (sourceNode) {
          // nodeLabel만 사용 (v3.0 CEL 형식)
          evaluationContext[sourceNode.data.label] = output;
        }
      }

      // 전역 상태 추가
      const stateObject: Record<string, any> = {};
      for (const [key, value] of globalState.entries()) {
        stateObject[key] = value;
      }
      evaluationContext["state"] = stateObject;

      try {
        const shouldExit = evaluateCondition(
          exitCondition.expression,
          evaluationContext
        );

        if (shouldExit) {
          context.onNodeResult?.(
            node.id,
            node.type,
            {
              type: "done",
              data: {
                reason: "exit_condition",
                iterations: iteration,
              },
            },
            "Loop 노드 반복 완료"
          );

          return { selectedHandleId: `${node.id}-exit`, iterations: iteration };
        }
      } catch (error) {
        // Exit condition 평가 실패 시 계속 진행
        context.onNodeResult?.(
          node.id,
          node.type,
          {
            type: "condition_evaluation_error",
            error: error instanceof Error ? error.message : String(error),
          },
          "Loop 노드 반복 Exit condition 평가 실패"
        );
      }
    }

    // 다음 반복으로 계속
  }

  // 최대 반복 횟수 도달
  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "done",
      data: {
        reason: "max_iterations",
        iterations: maxIterations,
      },
    },
    "Loop 노드 반복 완료"
  );

  return {
    selectedHandleId: `${node.id}-max-reached`,
    iterations: maxIterations,
  };
}

/**
 * 조건 노드 실행
 * 조건을 순서대로 평가하여 첫 번째로 true인 조건의 출력 핸들 ID를 반환
 */
async function executeConditionNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[]
): Promise<{ selectedHandleId: string }> {
  const conditions = node.data.nodeData?.conditions || [];

  // 1. 평가 컨텍스트 구성 (nodeType:nodeName 형식으로 키 생성하여 충돌 방지)
  const evaluationContext: Record<string, any> = {};
  const nodeOutputs = context.state.execution.nodeOutputs;
  const globalState = context.state.execution.globalState;

  // 모든 이전 노드의 출력을 nodeLabel 형식으로 접근 가능하게 구성 (v3.0 CEL)
  for (const [nodeId, output] of nodeOutputs.entries()) {
    const sourceNode = allNodes.find((n) => n.id === nodeId);
    if (sourceNode) {
      // nodeLabel만 사용 (v3.0 CEL 형식)
      evaluationContext[sourceNode.data.label] = output;
    }
  }

  // 전역 상태를 state 객체로 추가
  const stateObject: Record<string, any> = {};
  for (const [key, value] of globalState.entries()) {
    stateObject[key] = value;
  }
  evaluationContext["state"] = stateObject;

  // 2. 조건을 순서대로 평가
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];

    context.onNodeResult?.(node.id, node.type, {
      type: "condition_evaluating",
      conditionIndex: i,
      conditionLabel: condition.label,
      expression: condition.expression,
    });

    try {
      // 표현식이 비어있으면 건너뛰기
      if (!condition.expression || condition.expression.trim() === "") {
        console.warn(
          `[조건 평가] 조건 ${i + 1}의 표현식이 비어있어 건너뜁니다`
        );
        continue;
      }

      // 조건 평가
      const result = evaluateCondition(condition.expression, evaluationContext);

      // true인 조건을 찾으면 해당 출력 핸들 ID 반환
      if (result) {
        context.onNodeResult?.(
          node.id,
          node.type,
          {
            type: "condition_matched",
            data: {
              conditionIndex: i,
              conditionLabel: condition.label,
              selectedHandleId: condition.outputHandleId,
            },
          },
          "조건 노드 조건 매칭"
        );

        return { selectedHandleId: condition.outputHandleId };
      }
    } catch (error) {
      console.error(`[조건 평가 실패] 조건 ${i + 1}:`, error);
      // 조건 평가 실패 시 다음 조건으로 계속 진행
      context.onNodeResult?.(
        node.id,
        node.type,
        {
          type: "condition_evaluation_error",
          error: error instanceof Error ? error.message : String(error),
        },
        "조건 노드 조건 평가 실패(Exit condition)"
      );
      continue;
    }
  }

  // 3. 모든 조건이 false면 기본(else) 출력 핸들 선택
  const defaultHandleId =
    node.data.nodeData?.defaultOutputHandleId || `${node.id}-output-default`;

  return { selectedHandleId: defaultHandleId };
}
/**
 * Upload 노드 실행
 */
async function executeUploadNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[]
): Promise<any> {
  if (node.type !== "upload") {
    throw new Error("Upload 노드가 아닙니다");
  }

  const nodeData = node.data;

  context.onNodeResult?.(
    node.id,
    node.type,
    {
      type: "start",
    },
    "Upload 노드 실행 시작"
  );

  try {
    // 노드 데이터에서 미리 업로드된 파일 정보 가져오기
    // (UploadBox에서 이미 업로드 완료)
    const uploadedFile = nodeData.nodeData?.uploadedFile;

    if (!uploadedFile) {
      throw new Error("업로드된 파일이 없습니다");
    }

    // 파일 정보 반환 (fileUrl, fileName, fileType)
    const result = uploadedFile;

    context.onNodeResult?.(
      node.id,
      node.type,
      {
        type: "done",
        output: result,
      },
      "Upload 노드 실행 완료"
    );

    return result;
  } catch (error) {
    throw error;
  }
}

async function executeNode(
  node: AIWorkflowNodeType,
  context: WorkflowContextType,
  allNodes: AIWorkflowNodeType[],
  edges: AIWorkflowEdgeType[],
  initialInputs?: Record<string, any>
): Promise<any> {
  // 노드 타입별 실행
  switch (node.type) {
    case "start":
      return executeStartNode(node, context, initialInputs);
    case "tool":
      return executeToolNode(node, context, allNodes);
    case "llm":
      return executeLlmNode(node, context, edges, allNodes);
    case "transformer":
      return executeTransformerNode(node, context, allNodes, edges);
    case "end":
      return executeEndNode(node, context, edges, allNodes);
    case "rag":
      return executeRAGNode(node, context, edges, allNodes);
    case "condition":
      return executeConditionNode(node, context, allNodes, edges);
    case "state":
      return executeStateNode(node, context, allNodes, edges);
    case "loop":
      return executeLoopNode(node, context, allNodes, edges);
    case "upload":
      return executeUploadNode(node, context, allNodes, edges);
    default:
      throw new Error(
        `지원하지 않는 노드 타입: ${
          (node as { type?: string })?.type ?? "unknown"
        }`
      );
  }
}

/**
 * 워크플로우 실행 엔진
 * @template TNodeType - The node type to use (must extend AIWorkflowNodeType)
 */
export async function executeWorkflow<
  TNodeType extends AIWorkflowNodeType = AIWorkflowNodeType,
>(
  nodes: TNodeType[],
  edges: AIWorkflowEdgeType[],
  context: WorkflowContextType,
  initialInputs?: Record<string, any>
): Promise<any> {
  // 1. Start 노드 찾기
  const startNode = nodes.find((n) => n.type === "start");
  if (!startNode) {
    throw new Error("Start 노드를 찾을 수 없습니다");
  }

  // 2. 실행 시작
  context.resetExecution();

  const visited = new Set<string>();
  let finalResult: any = null;

  // 각 노드의 incoming edge 수 계산
  const incomingCount = new Map<string, number>();
  const completedPredecessors = new Map<string, number>();

  for (const node of nodes) {
    const incomingEdges = edges.filter((e) => e.target === node.id);
    incomingCount.set(node.id, incomingEdges.length);
    completedPredecessors.set(node.id, 0);
  }

  // 노드 실행 대기 중인 Promise들을 관리
  const pendingNodes = new Map<
    string,
    { resolve: () => void; count: number }
  >();

  // 3. 재귀 실행 함수
  async function executeNodeRecursive(nodeId: string): Promise<void> {
    // 현재 노드의 incoming edge 수
    const requiredPredecessors = incomingCount.get(nodeId) || 0;

    // 다중 입력 노드: 모든 선행 노드가 완료될 때까지 대기
    if (requiredPredecessors > 1) {
      // 이미 실행 완료된 노드인지 먼저 체크 (다중 입력이지만 이미 실행됨)
      if (visited.has(nodeId)) {
        return;
      }

      // 현재 완료된 predecessor 수 증가
      const currentCompleted = (completedPredecessors.get(nodeId) || 0) + 1;
      completedPredecessors.set(nodeId, currentCompleted);

      // 아직 모든 선행 노드가 완료되지 않았으면
      if (currentCompleted < requiredPredecessors) {
        // 첫 번째 도착이면 Promise 생성
        if (!pendingNodes.has(nodeId)) {
          await new Promise<void>((resolve) => {
            pendingNodes.set(nodeId, { resolve, count: currentCompleted });
          });
        } else {
          // 이미 대기 중이면 그냥 리턴 (다른 predecessor가 resolve할 것)
          return;
        }
      } else {
        // 모든 선행 노드 완료! 대기 중인 Promise가 있으면 resolve
        const pending = pendingNodes.get(nodeId);
        if (pending) {
          pending.resolve();
          pendingNodes.delete(nodeId);
        }
        // 계속 실행
      }
    }

    // 단일 입력 노드 또는 다중 입력 대기 완료: 이미 실행 완료된 노드인지 체크
    if (visited.has(nodeId)) {
      return;
    }

    // 즉시 visited에 추가하여 중복 실행 방지
    visited.add(nodeId);

    // 노드 찾기
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      console.error(`[에러] 노드를 찾을 수 없음: ${nodeId}`);
      return;
    }

    try {
      // 노드 실행 (Start 노드인 경우에만 initialInputs 전달)
      const output = await executeNode(
        node,
        context,
        nodes,
        edges,
        node.type === "start" ? initialInputs : undefined
      );

      // 출력 저장 - nodeOutputs Map에 직접 저장
      context.state.execution.nodeOutputs.set(nodeId, output);

      // End 노드이면 최종 결과 저장
      if (node.type === "end") {
        finalResult = output;
        return;
      }

      // 조건 노드인 경우: 선택된 핸들의 엣지만 실행
      if (node.type === "condition") {
        const selectedHandleId = (output as { selectedHandleId: string })
          .selectedHandleId;

        const selectedEdge = edges.find(
          (e) => e.source === nodeId && e.sourceHandle === selectedHandleId
        );

        if (!selectedEdge) {
          console.warn(`[경고] 선택된 핸들의 연결이 없음: ${selectedHandleId}`);
          return;
        }

        await executeNodeRecursive(selectedEdge.target);
        return;
      }

      // 다음 노드들 찾기 (일반 노드)
      const nextEdges = edges.filter((e) => e.source === nodeId);

      if (nextEdges.length === 0) {
        console.warn(`[경고] 다음 노드 없음: ${nodeId}`);
        return;
      }

      // 중복 타겟 제거 (같은 노드로 가는 여러 엣지가 있을 경우)
      const uniqueTargets = Array.from(
        new Set(nextEdges.map((edge) => edge.target))
      );

      // 다음 노드들 병렬 실행 (여러 노드에 분기되는 경우)
      await Promise.all(
        uniqueTargets.map((targetId) => executeNodeRecursive(targetId))
      );
    } catch (error) {
      console.error(`[에러] 노드 실행 실패: ${nodeId}`, error);
      // toast는 최상위에서 한 번만 표시하도록 throw만 수행
      context.onNodeResult?.(
        node.id,
        node.type,
        {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        },
        "노드 실행 실패"
      );
      throw error;
    }
  }

  // 4. Start 노드부터 실행
  await executeNodeRecursive(startNode.id);

  return finalResult;
}
