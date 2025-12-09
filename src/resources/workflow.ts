import { APIClient } from "../core/api-client";
import { AuthManager } from "../core/auth";
import { executeWorkflow } from "../workflow/workflow-executor";
import {
  WorkflowContext,
  WorkflowContextOptions,
  AIWorkflowNodeType,
  AIWorkflowEdgeType,
  AIWorkflowResponseData,
} from "../workflow/workflow-types";

export interface WorkflowResponse {
  success: boolean;
  status: number;
  data: AIWorkflowResponseData;
}

export interface RunWorkflowOptions {
  addExecutionLog?: WorkflowContextOptions["addExecutionLog"];
  executeCodeCallback?: WorkflowContextOptions["executeCodeCallback"];
}

export class Workflow {
  private apiClient: APIClient;
  private authManager: AuthManager;
  private baseURL: string;

  constructor(
    apiClient: APIClient,
    authManager: AuthManager,
    baseURL: string
  ) {
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.baseURL = baseURL;
  }

  /**
   * Fetch workflow data by workflow ID
   *
   * @param workflowId - Workflow ID to fetch
   * @returns Workflow data response
   */
  async fetch(workflowId: string): Promise<WorkflowResponse> {
    const accessToken = await this.authManager.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    return this.apiClient.get<WorkflowResponse>(
      `/ai-workflow/${workflowId}/version/current`,
      headers
    );
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
    const workflowResponse = await this.fetch(workflowId);
    const workflowData = workflowResponse.data.workflow_data;

    // Initialize workflow context with options
    const context = new WorkflowContext({
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
