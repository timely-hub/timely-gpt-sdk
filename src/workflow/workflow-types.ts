import type { Edge, Node } from "@xyflow/react";

export type AIWorkflowNodeKeyNames =
  | "start"
  | "tool"
  | "llm"
  | "end"
  | "transformer"
  | "rag"
  | "condition"
  | "loop";

export interface ExecutionLog {
  nodeId: string;
  nodeType: string;
  type: "start" | "complete" | "error" | "info" | "warning";
  message: string;
  timestamp: number;
  data?: any;
}
export interface WorkflowExecutionState {
  isExecuting: boolean;
  executingNodes: Set<string>;
  completedNodes: Set<string>;
  failedNodes: Map<string, string>;
  nodeOutputs: Map<string, any>;
  globalState: Map<string, any>; // 워크플로우 전역 상태 (state.*)
  logs: ExecutionLog[];
}
export type ExecuteCodeCallback = (
  toolName: string,
  args: Record<string, any>,
  functionCode: string
) => Promise<any>;

export interface WorkflowContextOptions {
  addExecutionLog?: (logs: Omit<ExecutionLog, "timestamp">) => void;
  onNodeResult?: (
    nodeId: string,
    nodeType: string,
    data: any,
    message?: string
  ) => void;
  executeCodeCallback?: ExecuteCodeCallback;
  baseURL?: string;
  getAccessToken?: () => Promise<string>;
  useStreamProxy?: boolean; // true면 /api/stream 사용, false면 직접 호출
  /**
   * true면 workflow의 custom/function tool 노드에 포함된 임의 코드(`function_body`) 실행을 차단한다.
   * 신뢰할 수 없는 출처의 workflow를 실행할 때 활성화 권장.
   * 기본값: false (기존 동작 유지). 미지정 시 1회성 경고가 출력된다.
   */
  disableCodeExecution?: boolean;
  /**
   * LLM 노드의 tool-call 재귀 깊이 한도. 한도 초과 시 에러를 throw 한다.
   * 비용 폭주/메모리 누적 방지용. 기본값: 25.
   */
  maxToolCallDepth?: number;
  /**
   * 워크플로우 내 비스트리밍 fetch 호출의 타임아웃(ms).
   * LLM 스트리밍 응답에는 적용되지 않는다. 기본값: 30000.
   */
  fetchTimeoutMs?: number;
}

export class WorkflowExecutionContext {
  private _state: {
    execution: WorkflowExecutionState;
  };

  private _onNodeResultCallback?: (
    nodeId: string,
    nodeType: string,
    data: any,
    message?: string
  ) => void;
  public executeCodeCallback?: ExecuteCodeCallback;
  public baseURL?: string;
  public getAccessToken?: () => Promise<string>;
  public useStreamProxy?: boolean;
  public disableCodeExecution?: boolean;
  public maxToolCallDepth?: number;
  public fetchTimeoutMs?: number;

  private _addExecutionLog?: (logs: Omit<ExecutionLog, "timestamp">) => void;

  constructor(options?: WorkflowContextOptions) {
    this._state = {
      execution: {
        isExecuting: false,
        executingNodes: new Set<string>(),
        completedNodes: new Set<string>(),
        failedNodes: new Map<string, string>(),
        nodeOutputs: new Map<string, any>(),
        globalState: new Map<string, any>(),
        logs: [],
      },
    };

    this._onNodeResultCallback = options?.onNodeResult;
    this.executeCodeCallback = options?.executeCodeCallback;
    this.baseURL = options?.baseURL;
    this.getAccessToken = options?.getAccessToken;
    this.useStreamProxy = options?.useStreamProxy;
    this.disableCodeExecution = options?.disableCodeExecution;
    this.maxToolCallDepth = options?.maxToolCallDepth;
    this.fetchTimeoutMs = options?.fetchTimeoutMs;
    this._addExecutionLog = options?.addExecutionLog;
  }

  // onNodeResult를 호출하면 자동으로 addExecutionLog도 호출
  public onNodeResult(
    nodeId: string,
    nodeType: string,
    data: any,
    message?: string
  ): void {
    // 콜백 호출
    this._onNodeResultCallback?.(nodeId, nodeType, data, message);
    if (this._addExecutionLog) {
      this._addExecutionLog({
        nodeId,
        nodeType,
        type: data.type,
        message: message || `${nodeType} - ${data.type}`,
        data,
      });
    }
  }

  // Read-only access to state
  get state(): { execution: WorkflowExecutionState } {
    return this._state;
  }

  // Reset execution state
  resetExecution(): void {
    this._state.execution = {
      isExecuting: false,
      executingNodes: new Set<string>(),
      completedNodes: new Set<string>(),
      failedNodes: new Map<string, string>(),
      nodeOutputs: new Map<string, any>(),
      globalState: new Map<string, any>(),
      logs: [],
    };
  }
}

// Legacy type for backward compatibility
export type WorkflowContextType = WorkflowExecutionContext;
export type AIWorkflowNodeDataCommon = {
  label: string;
  id?: string | null;
  inputBindings?: Record<string, string>;
};
export type AIWorkflowResponseData = {
  id: string;
  workflow_id: string;
  user_id: string;
  space_id: string;
  version: number;
  base_version: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  is_production: boolean;
  name: string | null;
  description: string | null;
  workflow_data: {
    nodes: {
      [key: string]: unknown;
    }[];
    edges: {
      [key: string]: unknown;
    }[];
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  archived_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowNodeType<
  NodeType extends string | undefined = string | undefined,
  NodeData extends Record<string, unknown> = Record<string, unknown>,
> = Node<NodeData & AIWorkflowNodeDataCommon, NodeType>;

// Generic type for workflow nodes - can accept specific node data types
export type AIWorkflowNodeType<TNodeData = any> = WorkflowNodeType<
  string,
  {
    data: {
      nodeData: TNodeData;
    };
  } & Record<string, any>
>;

export type AIWorkflowEdgeType = Edge<Record<string, unknown>, "custom">;

// Default workflow context instance
export const WORKFLOW_CONTEXT = new WorkflowExecutionContext();
