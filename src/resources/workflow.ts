import type { APIClient } from "../core/api-client";
import type { AuthManager } from "../core/auth";
import { executeWorkflow } from "../workflow/workflow-executor";
import type {
  AIWorkflowEdgeType,
  AIWorkflowNodeType,
  AIWorkflowResponseData,
  WorkflowContextOptions,
} from "../workflow/workflow-types";
import { WorkflowExecutionContext } from "../workflow/workflow-types";

export interface WorkflowResponse {
  success: boolean;
  status: number;
  data: AIWorkflowResponseData;
}

export interface WorkflowListParams {
  limit?: number;
  offset?: number;
}

export interface WorkflowListItem {
  id: string;
  workflow_id: string;
  version: number;
  base_version: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  is_production: boolean;
  name: string | null;
  description: string | null;
  archived_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  success: boolean;
  status: number;
  data: {
    workflows: WorkflowListItem[];
    total: number;
  };
}

export interface RunWorkflowOptions {
  addExecutionLog?: WorkflowContextOptions["addExecutionLog"];
  executeCodeCallback?: WorkflowContextOptions["executeCodeCallback"];
}

export interface WorkflowStartParams {
  schema: Record<string, any> | null;
  type: string;
}

export interface CustomToolInfo {
  toolName: string;
  requestSchema: Record<string, any> | null;
  responseSchema: Record<string, any> | null;
  functionBody: string | null;
}

export class Workflow {
  private apiClient: APIClient;
  private authManager: AuthManager;
  private baseURL: string;

  constructor(apiClient: APIClient, authManager: AuthManager, baseURL: string) {
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
  async list(params?: WorkflowListParams): Promise<WorkflowListResponse> {
    const accessToken = await this.authManager.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    // Build query string
    const queryParams = new URLSearchParams();
    queryParams.append("status", "PRODUCTION");
    if (params?.limit !== undefined) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params?.offset !== undefined) {
      queryParams.append("offset", params.offset.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `/ai-workflow/list?${queryString}`
      : "/ai-workflow/list";

    return this.apiClient.get<WorkflowListResponse>(endpoint, headers);
  }

  /**
   * Fetch workflow data by workflow ID
   *
   * @param workflowId - Workflow ID to fetch
   * @returns Workflow data response
   */
  async fetch(
    workflowId: string
  ): Promise<WorkflowResponse["data"]["workflow_data"]> {
    const accessToken = await this.authManager.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    const response = await this.apiClient.get<WorkflowResponse>(
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
  async getParams(workflowId: string): Promise<WorkflowStartParams> {
    // Fetch workflow data
    const workflowData = await this.fetch(workflowId);

    // Find start node
    const startNode = workflowData.nodes.find(
      (node: any) => node.type === "start"
    );

    if (!startNode) {
      return {
        schema: null,
        type: "unknown",
      };
    }

    const nodeData = (
      startNode.data as {
        nodeData: {
          schema: Record<string, any>;
          type: string;
        };
      }
    )?.nodeData;

    if (!nodeData) {
      return {
        schema: null,
        type: "unknown",
      };
    }

    return {
      schema: nodeData.schema || null,
      type: nodeData.type || "unknown",
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
  async getCustomTools(workflowId: string): Promise<CustomToolInfo[]> {
    // Fetch workflow data
    const workflowData = await this.fetch(workflowId);

    const customTools: CustomToolInfo[] = [];

    // Find all tool nodes with custom type
    const toolNodes = workflowData.nodes.filter(
      (node: any) =>
        node.type === "tool" && node.data?.nodeData?.type === "custom"
    );

    for (const node of toolNodes) {
      const nodeData = (node as any).data?.nodeData;
      const tool = nodeData?.tool;

      if (!tool) {
        continue;
      }

      customTools.push({
        toolName: tool.name || "Unknown",
        requestSchema: tool.schema || null,
        responseSchema: tool.response_schema || null,
        functionBody: tool.function_body || null,
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
  async run(
    workflowId: string,
    initialInputs: Record<string, any>,
    options?: RunWorkflowOptions
  ): Promise<any> {
    // Fetch workflow data
    const workflowData = await this.fetch(workflowId);

    // Initialize workflow context with options
    const context = new WorkflowExecutionContext({
      addExecutionLog: options?.addExecutionLog,
      executeCodeCallback: options?.executeCodeCallback,
      baseURL: this.baseURL,
      getAccessToken: () => this.authManager.getAccessToken(),
    });

    // Execute workflow
    const result = await executeWorkflow(
      workflowData.nodes as unknown as AIWorkflowNodeType[],
      workflowData.edges as unknown as AIWorkflowEdgeType[],
      context,
      initialInputs
    );

    return result;
  }
}
