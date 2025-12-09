// src/index.ts
import "dotenv/config";

// src/core/api-client.ts
var APIError = class extends Error {
  constructor(message, statusCode, error) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.name = "APIError";
  }
};
var APIClient = class {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        throw new APIError(
          `HTTP error ${response.status}: ${response.statusText}`,
          response.status
        );
      }
      throw new APIError(
        errorData.message || `HTTP error ${response.status}`,
        errorData.statusCode || response.status,
        errorData.error
      );
    }
    return response.json();
  }
  async get(endpoint, headers) {
    return this.request(endpoint, {
      method: "GET",
      headers
    });
  }
  async post(endpoint, body, headers) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers
    });
  }
  async streamPost(endpoint, body, headers) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        throw new APIError(
          `HTTP error ${response.status}: ${response.statusText}`,
          response.status
        );
      }
      throw new APIError(
        errorData.message || `HTTP error ${response.status}`,
        errorData.statusCode || response.status,
        errorData.error
      );
    }
    return response;
  }
};

// src/core/auth.ts
var AuthManager = class {
  constructor(apiKey, baseURL) {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.apiKey = apiKey;
    this.apiClient = new APIClient(baseURL);
  }
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    await this.authenticate();
    return this.accessToken;
  }
  async authenticate() {
    const response = await this.apiClient.get(
      "/sdk-auth/authenticate",
      {
        "X-Timely-API": this.apiKey
      }
    );
    if (!response.success || !response.data.access_token) {
      throw new Error("Failed to authenticate with API key");
    }
    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + 55 * 60 * 1e3;
  }
  clearToken() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
};

// src/core/stream.ts
var Stream = class {
  constructor(response) {
    this.response = response;
  }
  /**
   * 비동기 반복자를 반환합니다.
   *
   * @yields {StreamEvent} 스트림 이벤트
   * @throws {Error} 응답 본문이 null인 경우
   */
  async *[Symbol.asyncIterator]() {
    if (!this.response.body) {
      throw new Error("Response body is null");
    }
    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const event = JSON.parse(data);
            yield event;
            if (event.type === "end" || event.type === "error") {
              return;
            }
          } catch (error) {
            console.error("Failed to parse SSE data:", data, error);
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
};

// src/resources/chat.ts
var Completions = class {
  constructor(apiClient, authManager) {
    this.apiClient = apiClient;
    this.authManager = authManager;
  }
  async create(params) {
    if (!params.chat_model_node_id && !params.chat_model_node) {
      throw new Error(
        "Either chat_model_node_id or chat_model_node must be provided"
      );
    }
    const chatType = params.chat_type || "DYNAMIC_CHAT";
    if (chatType !== "NORMAL" && chatType !== "DYNAMIC_CHAT") {
      throw new Error(
        `Invalid chat_type: ${chatType}. Only "NORMAL" and "DYNAMIC_CHAT" are allowed.`
      );
    }
    const requestParams = {
      ...params,
      chat_type: chatType
    };
    const accessToken = await this.authManager.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };
    if (params.timezone) {
      headers["X-Timezone"] = params.timezone;
    }
    if (params.stream) {
      const response = await this.apiClient.streamPost(
        "/llm-completion",
        requestParams,
        headers
      );
      return new Stream(response);
    }
    return this.apiClient.post(
      "/llm-completion",
      requestParams,
      headers
    );
  }
};
var Chat = class {
  constructor(apiClient, authManager) {
    this.completions = new Completions(apiClient, authManager);
  }
};

// src/workflow/workflow-executor.ts
import "dotenv/config";

// src/workflow/evaluate-cel.ts
import { evaluate, parse } from "@marcbachmann/cel-js";
function convertBigIntToNumber(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(convertBigIntToNumber);
  }
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertBigIntToNumber(val);
    }
    return result;
  }
  return value;
}
function evaluateCEL(expression, context) {
  if (!expression || expression.trim() === "") {
    throw new Error("\uD45C\uD604\uC2DD\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4");
  }
  try {
    parse(expression);
    const result = evaluate(expression, context);
    return convertBigIntToNumber(result);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}
function evaluateCondition(expression, context) {
  return Boolean(evaluateCEL(expression, context));
}

// src/utils/object.ts
function setPath(obj, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((acc, key) => {
    if (!(key in acc) || typeof acc[key] !== "object" || acc[key] === null) {
      acc[key] = {};
    }
    return acc[key];
  }, obj);
  target[lastKey] = value;
}

// src/workflow/resolve-input-bindings.ts
function createCELContext(nodeOutputs, allNodes, globalState) {
  const context = {};
  for (const node of allNodes) {
    const output = nodeOutputs.get(node.id);
    if (output !== void 0) {
      context[node.data.label] = output;
    }
  }
  if (globalState) {
    context.state = globalState;
  }
  return context;
}
function resolveInputBindings(inputBindings, nodeOutputs, allNodes, globalState) {
  const resolved = {};
  if (!inputBindings || !allNodes) {
    return resolved;
  }
  const celContext = createCELContext(nodeOutputs, allNodes, globalState);
  for (const [targetKey, bindingPath] of Object.entries(inputBindings)) {
    try {
      const value = evaluateCEL(bindingPath, celContext);
      setPath(resolved, targetKey, value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[\uBC14\uC778\uB529 \uD574\uC11D \uC2E4\uD328] ${bindingPath}: ${message}`);
      continue;
    }
  }
  return resolved;
}

// src/workflow/workflow-executor.ts
var { executeCode } = {
  executeCode: async (code, params) => {
    try {
      const func = new Function("params", code);
      const result = await Promise.resolve(func(params));
      return {
        success: true,
        result,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};
async function executeStartNode(node, context, initialInputs) {
  const output = {
    type: node.type,
    timestamp: Date.now(),
    // Start 노드의 초기 입력 데이터
    ...initialInputs
  };
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "complete",
    message: `Start \uB178\uB4DC \uC2E4\uD589 \uC644\uB8CC`,
    data: output
  });
  return output;
}
async function executeToolNode(node, context, allNodes) {
  const toolNodeData = node.data;
  const inputs = resolveInputBindings(
    toolNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "info",
    message: `Tool \uB178\uB4DC \uC785\uB825 \uB370\uC774\uD130`,
    data: inputs
  });
  let result = null;
  try {
    const nodeData = node.data.nodeData;
    if (!nodeData) {
      throw new Error("Tool \uB178\uB4DC \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    if (nodeData.type === "custom") {
      const functionCode = nodeData.tool.function_body ?? "";
      const toolName = nodeData.tool.name || nodeData.tool.id || "unknown";
      if (context.executeCodeCallback) {
        result = await context.executeCodeCallback(
          toolName,
          inputs,
          functionCode
        );
      } else {
        const executionResult = await executeCode(functionCode, inputs);
        if (!executionResult.success) {
          throw new Error(
            executionResult.error || "Custom tool \uC2E4\uD589 \uC2E4\uD328 (\uC54C \uC218 \uC5C6\uB294 \uC624\uB958)"
          );
        }
        result = executionResult.result ?? executionResult;
      }
    } else if (nodeData.type === "built-in") {
      const accessToken = context.getAccessToken ? await context.getAccessToken() : "master";
      const response = await fetch(
        `${context.baseURL}/built-in-tool-node/${nodeData.tool.id}/invoke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ args: inputs })
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || response.statusText;
        throw new Error(`Built-in tool \uC2E4\uD589 \uC2E4\uD328: ${errorMessage}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(`Built-in tool \uC2E4\uD589 \uC2E4\uD328: ${data.error}`);
      }
      const output = data.output;
      result = output;
    } else if (nodeData.type === "mcp") {
      throw new Error("MCP \uB3C4\uAD6C \uC2E4\uD589\uC740 \uC544\uC9C1 \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4");
    }
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "complete",
      message: `Tool \uB178\uB4DC \uC2E4\uD589 \uC644\uB8CC`,
      data: result
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "error",
      message: `Tool \uB178\uB4DC \uC2E4\uD589 \uC2E4\uD328: ${errorMessage}`
    });
    throw error;
  }
}
async function executeLlmNode(node, context, edges, allNodes) {
  const llmNodeData = node.data;
  let inputs = resolveInputBindings(
    llmNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );
  if (!llmNodeData.inputBindings || Object.keys(inputs).length === 0) {
    const incomingEdges = edges.filter(
      (e) => e.target === node.id
    );
    if (incomingEdges.length > 0) {
      const sourceNodeId = incomingEdges[0].source;
      const sourceOutput = context.state.execution.nodeOutputs.get(sourceNodeId);
      if (sourceOutput) {
        if (typeof sourceOutput === "string") {
          inputs = { userMessage: sourceOutput };
        } else {
          inputs = sourceOutput;
        }
      }
    }
  }
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "info",
    message: `LLM \uB178\uB4DC \uC785\uB825 \uB370\uC774\uD130`,
    data: inputs
  });
  try {
    const nodeData = node.data.nodeData;
    if (!nodeData) {
      throw new Error("LLM \uB178\uB4DC \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    const chatModelNodeId = nodeData.id;
    if (!chatModelNodeId) {
      throw new Error("Chat Model Node ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    const sessionId = `workflow-${node.id}-${Date.now()}`;
    const allMessages = [];
    let parsedOutput = null;
    const processNonStream = async (requestBody, checkpointId = null, baseURL) => {
      const accessToken = context.getAccessToken ? await context.getAccessToken() : "master";
      const response = await fetch(`${baseURL}/llm-completion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          ...requestBody,
          checkpoint_id: checkpointId,
          stream: false
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || response.statusText;
        throw new Error(`LLM \uC2E4\uD589 \uC2E4\uD328: ${errorMessage}`);
      }
      const responseData = await response.json();
      if (responseData.error) {
        throw new Error(`LLM \uC2E4\uD589 \uC2E4\uD328: ${responseData.error}`);
      }
      if (responseData.type === "final_response") {
        allMessages.push({
          role: "assistant",
          content: responseData.message
        });
        if (responseData.parsed) {
          parsedOutput = responseData.parsed;
        }
      } else if (responseData.type === "tool_call_required") {
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "info",
          message: `\uB3C4\uAD6C \uD638\uCD9C \uD544\uC694`,
          data: responseData.tool_calls
        });
        const toolResults = await Promise.all(
          responseData.tool_calls.map(async (toolCall) => {
            let result2;
            const tool = nodeData.tools?.find(
              (t) => t.name === toolCall.name
            );
            if (!tool) {
              result2 = JSON.stringify({ error: "\uB3C4\uAD6C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" });
            } else if (tool.type === "custom") {
              const execResult = await executeCode(
                tool.functionCode || "",
                toolCall.args
              );
              if (!execResult.success) {
                result2 = JSON.stringify({
                  error: execResult.error || "\uB3C4\uAD6C \uC2E4\uD589 \uC2E4\uD328"
                });
              } else {
                result2 = JSON.stringify(execResult);
              }
            } else if (tool.type === "built-in") {
              const accessToken2 = context.getAccessToken ? await context.getAccessToken() : "master";
              const builtInResponse = await fetch(
                `${context.baseURL}/built-in-tool-node/${tool.id}/invoke`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken2}`
                  },
                  body: JSON.stringify({ args: toolCall.args })
                }
              );
              if (!builtInResponse.ok) {
                result2 = JSON.stringify({ error: "Built-in tool \uC2E4\uD589 \uC2E4\uD328" });
              } else {
                const builtInData = await builtInResponse.json();
                result2 = builtInData.data.output;
              }
            } else {
              result2 = JSON.stringify({ error: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uB3C4\uAD6C \uD0C0\uC785" });
            }
            return {
              role: "tool",
              name: toolCall.name,
              tool_call_id: toolCall.tool_call_id,
              content: result2
            };
          })
        );
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "info",
          message: `\uB3C4\uAD6C \uC2E4\uD589 \uC644\uB8CC`,
          data: toolResults
        });
        await processNonStream(
          {
            ...requestBody,
            messages: toolResults
          },
          responseData.configurable.checkpoint_id,
          context.baseURL || ""
        );
      } else if (responseData.type === "error") {
        throw new Error(responseData.error);
      }
    };
    const initialRequest = {
      session_id: sessionId,
      chat_model_node_id: chatModelNodeId,
      chat_model_node: nodeData.output_type === "JSON" && nodeData.output_schema ? {
        output_type: "JSON",
        output_schema: nodeData.output_schema
      } : null,
      files: [],
      locale: "ko",
      user_location: null,
      use_all_built_in_tools: false,
      use_background_summarize: true,
      checkpoint_id: null,
      stream: false,
      messages: [
        {
          role: "user",
          content: inputs.userMessage || JSON.stringify(inputs)
        }
      ]
    };
    await processNonStream(initialRequest, null, context.baseURL || "");
    let result;
    if (nodeData.output_type === "JSON" && parsedOutput) {
      result = parsedOutput;
    } else {
      result = {
        messages: allMessages,
        lastMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1] : null,
        timestamp: Date.now()
      };
    }
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "complete",
      message: `LLM \uB178\uB4DC \uC2E4\uD589 \uC644\uB8CC`,
      data: result
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "error",
      message: `LLM \uB178\uB4DC \uC2E4\uD589 \uC2E4\uD328: ${errorMessage}`
    });
    throw error;
  }
}
async function executeTransformerNode(node, context, allNodes, edges) {
  try {
    const nodeData = node.data.nodeData;
    if (!nodeData || !nodeData.userRequest) {
      throw new Error("Transformer \uB178\uB4DC\uC758 userRequest\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    const incomingEdges = edges.filter((e) => e.target === node.id);
    if (incomingEdges.length === 0) {
      throw new Error("Transformer \uB178\uB4DC\uC758 \uC774\uC804 \uB178\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    const sources = [];
    for (const edge of incomingEdges) {
      const sourceNode = allNodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;
      const sourceOutput = context.state.execution.nodeOutputs.get(
        sourceNode.id
      );
      if (!sourceOutput) {
        throw new Error(
          `\uC774\uC804 \uB178\uB4DC(${sourceNode.id})\uC758 \uCD9C\uB825\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4`
        );
      }
      sources.push({
        sourceOutput,
        sourceNode: {
          name: sourceNode.data.label || sourceNode.type || "Unknown",
          description: sourceNode.data.nodeData?.description || "Source node"
        }
      });
    }
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "info",
      message: `Transformer \uB178\uB4DC \uC785\uB825 \uB370\uC774\uD130 (${sources.length}\uAC1C \uC18C\uC2A4)`,
      data: sources
    });
    const outgoingEdge = edges.find((e) => e.source === node.id);
    const targetNode = outgoingEdge ? allNodes.find((n) => n.id === outgoingEdge.target) : null;
    if (!targetNode) {
      throw new Error("Transformer \uB178\uB4DC\uC758 \uB2E4\uC74C \uB178\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    const targetInputType = extractInputSchema(targetNode);
    const accessToken = context.getAccessToken ? await context.getAccessToken() : "master";
    const response = await fetch(
      `${context.baseURL}/ai-workflow/helper-node/auto-transformer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userRequest: nodeData.userRequest,
          sources,
          targetNode: {
            name: targetNode.data.label || targetNode.type,
            description: targetNode.data.nodeData?.description || "Target node"
          },
          targetInputType
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Auto-Transformer API \uC2E4\uD589 \uC2E4\uD328: ${response.statusText}`);
    }
    const data = await response.json();
    const result = data.data.result;
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "complete",
      message: `Transformer \uB178\uB4DC \uC2E4\uD589 \uC644\uB8CC`,
      data: result
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "error",
      message: `Transformer \uB178\uB4DC \uC2E4\uD589 \uC2E4\uD328: ${errorMessage}`
    });
    throw error;
  }
}
function extractInputSchema(node) {
  const nodeType = node.type;
  const nodeData = node.data.nodeData;
  switch (nodeType) {
    case "tool":
      return nodeData?.tool?.input_schema || "string";
    case "llm":
      return "string";
    case "transformer":
      return "string";
    case "end":
      return nodeData?.output_schema || "string";
    default:
      return "string";
  }
}
async function executeEndNode(node, context, edges, allNodes) {
  const endNodeData = node.data;
  const nodeData = endNodeData.nodeData;
  let inputs = resolveInputBindings(
    endNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );
  if (!endNodeData.inputBindings || Object.keys(inputs).length === 0) {
    const incomingEdges = edges.filter(
      (e) => e.target === node.id
    );
    if (incomingEdges.length > 0) {
      const sourceNodeId = incomingEdges[0].source;
      const sourceOutput = context.state.execution.nodeOutputs.get(sourceNodeId);
      if (sourceOutput) {
        if (nodeData.output_type === "TEXT") {
          inputs = {
            message: typeof sourceOutput === "string" ? sourceOutput : sourceOutput.lastMessage?.content || JSON.stringify(sourceOutput)
          };
        } else {
          inputs = { data: sourceOutput };
        }
      }
    }
  }
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "info",
    message: `End \uB178\uB4DC \uC785\uB825 \uB370\uC774\uD130`,
    data: inputs
  });
  let finalOutput;
  if (nodeData.output_type === "JSON") {
    finalOutput = inputs;
    if (nodeData.output_schema) {
    }
  } else {
    finalOutput = {
      message: inputs.message || JSON.stringify(inputs),
      timestamp: Date.now()
    };
  }
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "complete",
    message: `\uC6CC\uD06C\uD50C\uB85C\uC6B0 \uC2E4\uD589 \uC644\uB8CC`,
    data: finalOutput
  });
  return finalOutput;
}
async function executeRAGNode(node, context, edges, allNodes) {
  const ragNodeData = node.data;
  const nodeData = ragNodeData.nodeData;
  let inputs = resolveInputBindings(
    ragNodeData.inputBindings,
    context.state.execution.nodeOutputs,
    allNodes,
    context.state.execution.globalState
  );
  if (!ragNodeData.inputBindings || Object.keys(inputs).length === 0) {
    const incomingEdges = edges.filter(
      (e) => e.target === node.id
    );
    if (incomingEdges.length > 0) {
      const sourceNodeId = incomingEdges[0].source;
      const sourceOutput = context.state.execution.nodeOutputs.get(sourceNodeId);
      if (sourceOutput) {
        inputs = typeof sourceOutput === "string" ? { query: sourceOutput } : {
          query: sourceOutput.response || sourceOutput.userMessage || JSON.stringify(sourceOutput)
        };
      }
    }
  }
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "info",
    message: `RAG \uB178\uB4DC \uC785\uB825 \uB370\uC774\uD130`,
    data: inputs
  });
  try {
    if (!nodeData?.storage_id) {
      throw new Error("RAG Storage\uAC00 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4");
    }
    const query = inputs.query;
    if (!query || typeof query !== "string") {
      throw new Error("\uAC80\uC0C9 \uCFFC\uB9AC\uAC00 \uC5C6\uAC70\uB098 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4");
    }
    const requestBody = {
      query,
      top_k: nodeData.top_k ?? 5,
      search_type: nodeData.search_type ?? "similarity"
    };
    if (nodeData.fileNames && nodeData.fileNames.length > 0) {
      requestBody.fileNames = nodeData.fileNames;
    }
    if (nodeData.search_type === "mmr" && nodeData.mmr_lambda !== void 0) {
      requestBody.mmr_lambda = nodeData.mmr_lambda;
    }
    if (nodeData.filter_metadata) {
      requestBody.filter_metadata = nodeData.filter_metadata;
    }
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "info",
      message: `RAG \uAC80\uC0C9 \uC2DC\uC791`,
      data: { storage_id: nodeData.storage_id, ...requestBody }
    });
    const accessToken = context.getAccessToken ? await context.getAccessToken() : "master";
    const response = await fetch(
      `${context.baseURL}/ai-workflow/rag-storage-node/${nodeData.storage_id}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestBody)
      }
    );
    if (!response.ok) {
      throw new Error(`RAG \uAC80\uC0C9 \uC2E4\uD328: ${response.statusText}`);
    }
    const data = await response.json();
    const result = data.data?.context || data.context || "";
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "info",
      message: `RAG \uAC80\uC0C9 \uC644\uB8CC`,
      data: { result_length: result.length }
    });
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "complete",
      message: `RAG \uB178\uB4DC \uC2E4\uD589 \uC644\uB8CC`,
      data: result
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "error",
      message: `RAG \uB178\uB4DC \uC2E4\uD589 \uC2E4\uD328: ${errorMessage}`
    });
    throw error;
  }
}
async function executeStateNode(node, context, allNodes, edges) {
  const stateUpdates = node.data.nodeData?.stateUpdates || [];
  const nodeOutputs = context.state.execution.nodeOutputs;
  const globalState = context.state.execution.globalState;
  const celContext = {};
  for (const n of allNodes) {
    const output = nodeOutputs.get(n.id);
    if (output !== void 0) {
      celContext[n.data.label] = output;
    }
  }
  const stateObject = {};
  for (const [key, value] of globalState.entries()) {
    stateObject[key] = value;
  }
  celContext.state = stateObject;
  for (const update of stateUpdates) {
    if (!update.key) {
      console.warn(`[State \uB178\uB4DC] \uC0C1\uD0DC \uD0A4\uAC00 \uBE44\uC5B4\uC788\uC5B4 \uAC74\uB108\uB701\uB2C8\uB2E4`);
      continue;
    }
    let value;
    if (update.binding) {
      try {
        value = evaluateCEL(update.binding, celContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[State \uB178\uB4DC] \uBC14\uC778\uB529 \uD3C9\uAC00 \uC2E4\uD328: ${update.binding}`, error);
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "warning",
          message: `\uBC14\uC778\uB529 \uD3C9\uAC00 \uC2E4\uD328: "${update.binding}" - ${message}`
        });
        continue;
      }
    } else {
      value = update.value;
    }
    globalState.set(update.key, value);
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "info",
      message: `\uC0C1\uD0DC \uC124\uC815: state.${update.key}`,
      data: { key: update.key, value }
    });
  }
  const result = {};
  for (const [key, value] of globalState.entries()) {
    result[key] = value;
  }
  return result;
}
async function executeInternalLoopGraph(startNodeId, loopEndHandleId, loopNodeId, context, allNodes, edges) {
  const visited = /* @__PURE__ */ new Set();
  let currentNodeId = startNodeId;
  while (currentNodeId) {
    if (visited.has(currentNodeId)) {
      throw new Error(`Loop \uB0B4\uBD80\uC5D0\uC11C \uC21C\uD658 \uCC38\uC870 \uBC1C\uACAC: ${currentNodeId}`);
    }
    visited.add(currentNodeId);
    const currentNode = allNodes.find((n) => n.id === currentNodeId);
    if (!currentNode) {
      throw new Error(`\uB178\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC74C: ${currentNodeId}`);
    }
    const output = await executeNode(
      currentNode,
      context,
      allNodes,
      edges,
      void 0
    );
    context.state.execution.nodeOutputs.set(currentNodeId, output);
    const toLoopEndEdge = edges.find(
      (e) => e.source === currentNodeId && e.target === loopNodeId && e.targetHandle === loopEndHandleId
    );
    if (toLoopEndEdge) {
      context.addExecutionLog({
        nodeId: loopNodeId,
        nodeType: "loop",
        type: "info",
        message: `Loop \uB0B4\uBD80 \uB05D\uC5D0 \uB3C4\uB2EC`
      });
      break;
    }
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    if (outgoingEdges.length === 0) {
      throw new Error(
        `Loop \uB0B4\uBD80 \uB178\uB4DC ${currentNodeId}\uC5D0\uC11C Loop \uB05D\uC73C\uB85C \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC74C`
      );
    }
    if (currentNode.type === "condition" && output.selectedHandleId) {
      const nextEdge = outgoingEdges.find(
        (e) => e.sourceHandle === output.selectedHandleId
      );
      if (!nextEdge) {
        throw new Error(
          `Condition \uB178\uB4DC ${currentNodeId}\uC758 \uCD9C\uB825 \uD578\uB4E4 ${output.selectedHandleId}\uC5D0 \uC5F0\uACB0\uB41C \uC5E3\uC9C0 \uC5C6\uC74C`
        );
      }
      currentNodeId = nextEdge.target;
    } else {
      currentNodeId = outgoingEdges[0].target;
    }
  }
}
async function executeLoopNode(node, context, allNodes, edges) {
  const loopNodeData = node.data;
  const {
    exitCondition,
    maxIterations = 10,
    loopStartHandleId,
    loopEndHandleId
  } = loopNodeData.nodeData || {};
  const actualLoopStartHandleId = loopStartHandleId || `${node.id}-loop-start`;
  const actualLoopEndHandleId = loopEndHandleId || `${node.id}-loop-end`;
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "info",
    message: `Loop \uC2DC\uC791 (\uCD5C\uB300 ${maxIterations}\uD68C)`
  });
  const loopStartEdge = edges.find(
    (e) => e.source === node.id && e.sourceHandle === actualLoopStartHandleId
  );
  if (!loopStartEdge) {
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "warning",
      message: "Loop \uB0B4\uBD80 \uC2DC\uC791 \uD578\uB4E4\uC5D0 \uC5F0\uACB0\uB41C \uB178\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4"
    });
    return { selectedHandleId: `${node.id}-exit`, iterations: 0 };
  }
  const firstInternalNodeId = loopStartEdge.target;
  let iteration = 0;
  for (iteration = 1; iteration <= maxIterations; iteration++) {
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "info",
      message: `Loop \uBC18\uBCF5 ${iteration}/${maxIterations} \uC2DC\uC791`
    });
    try {
      await executeInternalLoopGraph(
        firstInternalNodeId,
        actualLoopEndHandleId,
        node.id,
        context,
        allNodes,
        edges
      );
      context.addExecutionLog({
        nodeId: node.id,
        nodeType: node.type,
        type: "info",
        message: `Loop \uBC18\uBCF5 ${iteration}/${maxIterations} \uC644\uB8CC`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.addExecutionLog({
        nodeId: node.id,
        nodeType: node.type,
        type: "error",
        message: `Loop \uB0B4\uBD80 \uC2E4\uD589 \uC2E4\uD328 (${iteration}\uD68C\uCC28): ${errorMessage}`
      });
      throw error;
    }
    if (exitCondition?.expression) {
      const evaluationContext = {};
      const nodeOutputs = context.state.execution.nodeOutputs;
      const globalState = context.state.execution.globalState;
      for (const [nodeId, output] of nodeOutputs.entries()) {
        const sourceNode = allNodes.find((n) => n.id === nodeId);
        if (sourceNode) {
          evaluationContext[sourceNode.data.label] = output;
        }
      }
      const stateObject = {};
      for (const [key, value] of globalState.entries()) {
        stateObject[key] = value;
      }
      evaluationContext["state"] = stateObject;
      try {
        const shouldExit = evaluateCondition(
          exitCondition.expression,
          evaluationContext
        );
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "info",
          message: `Exit condition \uD3C9\uAC00: ${exitCondition.expression} => ${shouldExit}`
        });
        if (shouldExit) {
          context.addExecutionLog({
            nodeId: node.id,
            nodeType: node.type,
            type: "complete",
            message: `Loop \uC885\uB8CC - exit condition \uB9CC\uC871 (${iteration}\uD68C \uBC18\uBCF5)`
          });
          return { selectedHandleId: `${node.id}-exit`, iterations: iteration };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "error",
          message: `Exit condition \uD3C9\uAC00 \uC2E4\uD328: ${errorMessage}`
        });
      }
    }
  }
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "complete",
    message: `Loop \uC885\uB8CC - \uCD5C\uB300 \uBC18\uBCF5 \uD69F\uC218 \uB3C4\uB2EC (${maxIterations}\uD68C)`
  });
  return {
    selectedHandleId: `${node.id}-max-reached`,
    iterations: maxIterations
  };
}
async function executeConditionNode(node, context, allNodes, edges) {
  const conditions = node.data.nodeData?.conditions || [];
  const evaluationContext = {};
  const nodeOutputs = context.state.execution.nodeOutputs;
  const globalState = context.state.execution.globalState;
  for (const [nodeId, output] of nodeOutputs.entries()) {
    const sourceNode = allNodes.find((n) => n.id === nodeId);
    if (sourceNode) {
      evaluationContext[sourceNode.data.label] = output;
    }
  }
  const stateObject = {};
  for (const [key, value] of globalState.entries()) {
    stateObject[key] = value;
  }
  evaluationContext["state"] = stateObject;
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "info",
      message: `\uC870\uAC74 ${i + 1} \uD3C9\uAC00: ${condition.label || `\uC870\uAC74 ${i + 1}`}`
    });
    try {
      if (!condition.expression || condition.expression.trim() === "") {
        console.warn(
          `[\uC870\uAC74 \uD3C9\uAC00] \uC870\uAC74 ${i + 1}\uC758 \uD45C\uD604\uC2DD\uC774 \uBE44\uC5B4\uC788\uC5B4 \uAC74\uB108\uB701\uB2C8\uB2E4`
        );
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "warning",
          message: `\uC870\uAC74 ${i + 1}\uC758 \uD45C\uD604\uC2DD\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4`
        });
        continue;
      }
      const result = evaluateCondition(condition.expression, evaluationContext);
      context.addExecutionLog({
        nodeId: node.id,
        nodeType: node.type,
        type: "info",
        message: `\uC870\uAC74 ${i + 1} \uD3C9\uAC00 \uACB0\uACFC: ${result}`,
        data: { expression: condition.expression, result }
      });
      if (result) {
        context.addExecutionLog({
          nodeId: node.id,
          nodeType: node.type,
          type: "complete",
          message: `\uC870\uAC74 ${i + 1}\uC774 true - "${condition.label}" \uACBD\uB85C \uC120\uD0DD`
        });
        return { selectedHandleId: condition.outputHandleId };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[\uC870\uAC74 \uD3C9\uAC00 \uC2E4\uD328] \uC870\uAC74 ${i + 1}:`, errorMessage);
      context.addExecutionLog({
        nodeId: node.id,
        nodeType: node.type,
        type: "error",
        message: `\uC870\uAC74 ${i + 1} \uD3C9\uAC00 \uC2E4\uD328: ${errorMessage}`
      });
      continue;
    }
  }
  const defaultHandleId = node.data.nodeData?.defaultOutputHandleId || `${node.id}-output-default`;
  context.addExecutionLog({
    nodeId: node.id,
    nodeType: node.type,
    type: "complete",
    message: "\uBAA8\uB4E0 \uC870\uAC74\uC774 false - else(\uAE30\uBCF8) \uACBD\uB85C \uC120\uD0DD"
  });
  return { selectedHandleId: defaultHandleId };
}
async function executeNode(node, context, allNodes, edges, initialInputs) {
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
    default:
      throw new Error(
        `\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uB178\uB4DC \uD0C0\uC785: ${node?.type ?? "unknown"}`
      );
  }
}
async function executeWorkflow(nodes, edges, context, initialInputs) {
  const startNode = nodes.find((n) => n.type === "start");
  if (!startNode) {
    throw new Error("Start \uB178\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
  }
  context.resetExecution();
  const visited = /* @__PURE__ */ new Set();
  let finalResult = null;
  const incomingCount = /* @__PURE__ */ new Map();
  const completedPredecessors = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const incomingEdges = edges.filter((e) => e.target === node.id);
    incomingCount.set(node.id, incomingEdges.length);
    completedPredecessors.set(node.id, 0);
  }
  const pendingNodes = /* @__PURE__ */ new Map();
  async function executeNodeRecursive(nodeId) {
    const requiredPredecessors = incomingCount.get(nodeId) || 0;
    if (requiredPredecessors > 1) {
      if (visited.has(nodeId)) {
        return;
      }
      const currentCompleted = (completedPredecessors.get(nodeId) || 0) + 1;
      completedPredecessors.set(nodeId, currentCompleted);
      if (currentCompleted < requiredPredecessors) {
        if (!pendingNodes.has(nodeId)) {
          await new Promise((resolve) => {
            pendingNodes.set(nodeId, { resolve, count: currentCompleted });
          });
        } else {
          return;
        }
      } else {
        const pending = pendingNodes.get(nodeId);
        if (pending) {
          pending.resolve();
          pendingNodes.delete(nodeId);
        }
      }
    }
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      console.error(`[\uC5D0\uB7EC] \uB178\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC74C: ${nodeId}`);
      return;
    }
    context.addExecutionLog({
      nodeId: node.id,
      nodeType: node.type,
      type: "start",
      message: `${node.type} \uB178\uB4DC \uC2E4\uD589 \uC2DC\uC791: ${node.data.label || node.id}`
    });
    try {
      const output = await executeNode(
        node,
        context,
        nodes,
        edges,
        node.type === "start" ? initialInputs : void 0
      );
      context.state.execution.nodeOutputs.set(nodeId, output);
      context.addExecutionLog({
        nodeId: node.id,
        nodeType: node.type,
        type: "complete",
        message: `${node.type} \uB178\uB4DC \uC2E4\uD589 \uC644\uB8CC: ${node.data.label || node.id}`,
        data: output
      });
      if (node.type === "end") {
        finalResult = output;
        return;
      }
      if (node.type === "condition") {
        const selectedHandleId = output.selectedHandleId;
        const selectedEdge = edges.find(
          (e) => e.source === nodeId && e.sourceHandle === selectedHandleId
        );
        if (!selectedEdge) {
          console.warn(`[\uACBD\uACE0] \uC120\uD0DD\uB41C \uD578\uB4E4\uC758 \uC5F0\uACB0\uC774 \uC5C6\uC74C: ${selectedHandleId}`);
          return;
        }
        await executeNodeRecursive(selectedEdge.target);
        return;
      }
      const nextEdges = edges.filter((e) => e.source === nodeId);
      if (nextEdges.length === 0) {
        console.warn(`[\uACBD\uACE0] \uB2E4\uC74C \uB178\uB4DC \uC5C6\uC74C: ${nodeId}`);
        return;
      }
      const uniqueTargets = Array.from(
        new Set(nextEdges.map((edge) => edge.target))
      );
      await Promise.all(
        uniqueTargets.map((targetId) => executeNodeRecursive(targetId))
      );
    } catch (error) {
      console.error(`[\uC5D0\uB7EC] \uB178\uB4DC \uC2E4\uD589 \uC2E4\uD328: ${nodeId}`, error);
      const errorMessage = `\uB178\uB4DC \uC2E4\uD589 \uC2E4\uD328 (${node.data.label || nodeId}): ${error instanceof Error ? error.message : String(error)}`;
      context.addExecutionLog({
        nodeId: node.id,
        nodeType: node.type,
        type: "error",
        message: errorMessage
      });
      throw error;
    }
  }
  await executeNodeRecursive(startNode.id);
  return finalResult;
}

// src/workflow/workflow-types.ts
var WorkflowContext = class {
  constructor(options) {
    this._state = {
      execution: {
        isExecuting: false,
        executingNodes: /* @__PURE__ */ new Set(),
        completedNodes: /* @__PURE__ */ new Set(),
        failedNodes: /* @__PURE__ */ new Map(),
        nodeOutputs: /* @__PURE__ */ new Map(),
        globalState: /* @__PURE__ */ new Map(),
        logs: []
      }
    };
    this.addExecutionLog = options?.addExecutionLog || ((logs) => {
      console.log(`[${logs.nodeType}] ${logs.message}`);
    });
    this.executeCodeCallback = options?.executeCodeCallback;
    this.baseURL = options?.baseURL;
    this.getAccessToken = options?.getAccessToken;
  }
  // Read-only access to state
  get state() {
    return this._state;
  }
  // Reset execution state
  resetExecution() {
    this._state.execution = {
      isExecuting: false,
      executingNodes: /* @__PURE__ */ new Set(),
      completedNodes: /* @__PURE__ */ new Set(),
      failedNodes: /* @__PURE__ */ new Map(),
      nodeOutputs: /* @__PURE__ */ new Map(),
      globalState: /* @__PURE__ */ new Map(),
      logs: []
    };
  }
};
var WORKFLOW_CONTEXT = new WorkflowContext();

// src/resources/workflow.ts
var Workflow = class {
  constructor(apiClient, authManager, baseURL) {
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.baseURL = baseURL;
  }
  /**
   * List workflows created by the user
   *
   * @param params - Query parameters for pagination
   * @param params.limit - Maximum number of workflows to return (optional)
   * @param params.offset - Number of workflows to skip (optional)
   * @returns List of workflows
   *
   * @example
   * ```typescript
   * // Get first 10 workflows
   * const workflows = await client.workflow.list({ limit: 10, offset: 0 });
   *
   * // Get all workflows (no pagination)
   * const allWorkflows = await client.workflow.list();
   * ```
   */
  async list(params) {
    const accessToken = await this.authManager.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };
    const queryParams = new URLSearchParams();
    queryParams.append("status", "PRODUCTION");
    if (params?.limit !== void 0) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params?.offset !== void 0) {
      queryParams.append("offset", params.offset.toString());
    }
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/ai-workflow/list?${queryString}` : "/ai-workflow/list";
    return this.apiClient.get(endpoint, headers);
  }
  /**
   * Fetch workflow data by workflow ID
   *
   * @param workflowId - Workflow ID to fetch
   * @returns Workflow data response
   */
  async fetch(workflowId) {
    const accessToken = await this.authManager.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };
    const response = await this.apiClient.get(
      `/ai-workflow/${workflowId}/version/current`,
      headers
    );
    return response?.data?.workflow_data;
  }
  /**
   * Get start parameters schema from workflow
   *
   * @param workflowId - Workflow ID to fetch and extract parameters from
   * @returns Start node parameters schema information
   *
   * @example
   * ```typescript
   * const params = await client.workflow.getParams('workflow_id');
   * console.log(params.schema); // JSON Schema 2.0 object
   * console.log(params.type);   // "form"
   * ```
   */
  async getParams(workflowId) {
    const workflowData = await this.fetch(workflowId);
    const startNode = workflowData.nodes.find(
      (node) => node.type === "start"
    );
    if (!startNode) {
      return {
        schema: null,
        type: "unknown"
      };
    }
    const nodeData = startNode.data?.nodeData;
    if (!nodeData) {
      return {
        schema: null,
        type: "unknown"
      };
    }
    return {
      schema: nodeData.schema || null,
      type: nodeData.type || "unknown"
    };
  }
  /**
   * Get custom tools information from workflow
   *
   * @param workflowId - Workflow ID to fetch and extract custom tools from
   * @returns Array of custom tool information
   *
   * @example
   * ```typescript
   * const customTools = await client.workflow.getCustomTools('workflow_id');
   *
   * customTools.forEach(tool => {
   *   console.log(`Tool: ${tool.toolName}`);
   *   console.log(`Input Schema:`, tool.requestSchema);
   *   console.log(`Response Schema:`, tool.responseSchema);
   *   console.log(`Function:`, tool.functionBody);
   * });
   * ```
   */
  async getCustomTools(workflowId) {
    const workflowData = await this.fetch(workflowId);
    const customTools = [];
    const toolNodes = workflowData.nodes.filter(
      (node) => node.type === "tool" && node.data?.nodeData?.type === "custom"
    );
    for (const node of toolNodes) {
      const nodeData = node.data?.nodeData;
      const tool = nodeData?.tool;
      if (!tool) {
        continue;
      }
      customTools.push({
        toolName: tool.name || "Unknown",
        requestSchema: tool.schema || null,
        responseSchema: tool.response_schema || null,
        functionBody: tool.function_body || null
      });
    }
    return customTools;
  }
  /**
   * Run a workflow by fetching its data and executing it
   *
   * @param workflowId - Workflow ID to run
   * @param initialInputs - Initial input values for the workflow
   * @param options - Optional execution callbacks
   * @returns Workflow execution result
   *
   * @example
   * ```typescript
   * const result = await client.workflow.run('workflow_123', {
   *   startMessage: 'Hello world'
   * }, {
   *   addExecutionLog: (logs) => console.log(logs),
   *   executeCodeCallback: async (toolName, args, code) => {
   *     // Custom code execution logic
   *     return customExecute(code, args);
   *   }
   * });
   * ```
   */
  async run(workflowId, initialInputs, options) {
    const workflowData = await this.fetch(workflowId);
    const context = new WorkflowContext({
      addExecutionLog: options?.addExecutionLog,
      executeCodeCallback: options?.executeCodeCallback,
      baseURL: this.baseURL,
      getAccessToken: () => this.authManager.getAccessToken()
    });
    const result = await executeWorkflow(
      workflowData.nodes,
      workflowData.edges,
      context,
      initialInputs
    );
    return result;
  }
};

// src/generated/models.ts
var AVAILABLE_MODELS = [
  "gpt-5.1",
  "gpt-5.1 chat",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-o4-mini",
  "gpt-o3",
  "gpt-5.1-codex",
  "gpt-5.1-codex-mini",
  "gpt-5-codex",
  "codex-mini",
  "gemini-3-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-1",
  "claude-sonnet-4-0",
  "claude-opus-4-0",
  "llama-4-scout-17b",
  "llama-4-maverick-17b",
  "mistral-small",
  "mistral-medium",
  "mistral-large",
  "magistral-medium",
  "magistral-small",
  "devstral-medium",
  "codestral",
  "qwen-qwq-32b",
  "grok-4-1-fast-non-reasoning",
  "grok-4-fast-reasoning",
  "grok-4-fast-non-reasoning",
  "grok-4",
  "grok-3",
  "grok-3-mini",
  "grok-code-fast",
  "solar-pro2"
];

// src/index.ts
var TimelyGPTClient = class {
  /**
   * TimelyGPTClient 인스턴스를 생성합니다.
   *
   * @param options - 클라이언트 설정 (선택사항)
   * @param options.apiKey - Timely GPT API 키 (환경변수 TIMELY_API_KEY 사용 가능)
   * @param options.baseURL - API 베이스 URL (환경변수 TIMELY_BASE_URL 또는 기본값: 'https://hello.timelygpt.co.kr/api/v2/chat')
   *
   * @throws {Error} apiKey가 제공되지 않고 환경변수도 없는 경우
   *
   * @example
   * ```typescript
   * // 환경변수 사용 (TIMELY_API_KEY, TIMELY_BASE_URL)
   * const client = new TimelyGPTClient({});
   *
   * // 직접 지정
   * const client = new TimelyGPTClient({
   *   apiKey: 'sdk_live_your_api_key_here',
   *   baseURL: 'https://hello.timelygpt.co.kr/api/v2/chat',
   * });
   * ```
   */
  constructor(options = {}) {
    const apiKey = options.apiKey || process.env.TIMELY_API_KEY;
    const baseURL = options.baseURL || process.env.TIMELY_BASE_URL || "https://hello.timelygpt.co.kr/api/v2/chat";
    if (!apiKey) {
      throw new Error(
        "API key is required. Provide it via options.apiKey or TIMELY_API_KEY environment variable."
      );
    }
    this.authManager = new AuthManager(apiKey, baseURL);
    const apiClient = new APIClient(baseURL);
    this.chat = new Chat(apiClient, this.authManager);
    this.workflow = new Workflow(apiClient, this.authManager, baseURL);
  }
};
var index_default = TimelyGPTClient;
export {
  APIError,
  AVAILABLE_MODELS,
  Stream,
  TimelyGPTClient,
  WorkflowContext,
  index_default as default,
  executeWorkflow
};
