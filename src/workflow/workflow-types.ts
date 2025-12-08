import { Edge, Node } from "@xyflow/react";
import { WorkflowExecutionState } from "./workflow-executor";

export type AIWorkflowNodeKeyNames =
  | "start"
  | "tool"
  | "llm"
  | "end"
  | "transformer"
  | "rag"
  | "condition"
  | "loop";

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
  NodeData extends Record<string, unknown> = Record<string, unknown>
> = Node<NodeData & AIWorkflowNodeDataCommon, NodeType>;
export type AIWorkflowNodeType = WorkflowNodeType<
  string,
  {
    data: {
      nodeData: {
        [key: string]: any;
      };
    };
  } & Record<string, any>
>;

export type AIWorkflowEdgeType = Edge<Record<string, unknown>, "custom">;

const WORKFLOW_EXECUTION_STATE_DEFAULT: {
  execution: WorkflowExecutionState;
} = {
  execution: {
    isExecuting: false,
    executingNodes: new Set(),
    completedNodes: new Set(),
    failedNodes: new Map(),
    nodeOutputs: new Map(),
    globalState: new Map(),
    logs: [],
  },
};

export const WORKFLOW_CONTEXT = {
  state: {
    ...WORKFLOW_EXECUTION_STATE_DEFAULT,
  },
  addExecutionLog: (logs: Record<string, any>) => {
    console.log(logs);
  },
  resetExecution: () => {
    WORKFLOW_CONTEXT.state.execution = {
      isExecuting: false,
      executingNodes: new Set(),
      completedNodes: new Set(),
      failedNodes: new Map(),
      nodeOutputs: new Map(),
      globalState: new Map(),
      logs: [],
    };
  },
};
