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
  executeCodeCallback?: ExecuteCodeCallback;
  baseURL?: string;
  getAccessToken?: () => Promise<string>;
}

export class WorkflowExecutionContext {
  private _state: {
    execution: WorkflowExecutionState;
  };

  public addExecutionLog: (logs: Omit<ExecutionLog, "timestamp">) => void;
  public executeCodeCallback?: ExecuteCodeCallback;
  public baseURL?: string;
  public getAccessToken?: () => Promise<string>;

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

    this.addExecutionLog =
      options?.addExecutionLog ||
      ((logs: Omit<ExecutionLog, "timestamp">) => {
        console.log(`[${logs.nodeType}] ${logs.message}`);
      });

    this.executeCodeCallback = options?.executeCodeCallback;
    this.baseURL = options?.baseURL;
    this.getAccessToken = options?.getAccessToken;
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
