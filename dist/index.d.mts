import { Node, Edge } from '@xyflow/react';

/**
 * API 요청 실패 시 발생하는 오류
 *
 * @example
 * ```typescript
 * try {
 *   const response = await client.chat.completions.create({...});
 * } catch (error) {
 *   if (error instanceof APIError) {
 *     console.error('API Error:', error.message);
 *     console.error('Status Code:', error.statusCode);
 *     console.error('Error Type:', error.error);
 *   }
 * }
 * ```
 */
declare class APIError extends Error {
    /** HTTP 상태 코드 */
    statusCode: number;
    /** 오류 타입 */
    error?: string | undefined;
    constructor(message: string, 
    /** HTTP 상태 코드 */
    statusCode: number, 
    /** 오류 타입 */
    error?: string | undefined);
}
/**
 * HTTP API 클라이언트
 * @internal
 */
declare class APIClient {
    private baseURL;
    constructor(baseURL: string);
    private request;
    get<T>(endpoint: string, headers?: Record<string, string>): Promise<T>;
    post<T>(endpoint: string, body: any, headers?: Record<string, string>): Promise<T>;
    streamPost(endpoint: string, body: any, headers?: Record<string, string>): Promise<Response>;
}

declare class AuthManager {
    private apiClient;
    private apiKey;
    private accessToken;
    private tokenExpiresAt;
    constructor(apiKey: string, baseURL: string);
    getAccessToken(): Promise<string>;
    private authenticate;
    clearToken(): void;
}

/**
 * Available model types from Timely GPT API
 *
 * To regenerate this file, run:
 * npm run generate-models
 */
type ModelType = 'gpt-5.2' | 'gpt-5.2 chat' | 'gpt-5.1' | 'gpt-5.1 chat' | 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-4.1-mini' | 'gpt-4.1' | 'gpt-4o-mini' | 'gpt-4o' | 'gpt-o4-mini' | 'gpt-o3' | 'gpt-5.1-codex' | 'gpt-5.1-codex-mini' | 'gpt-5-codex' | 'codex-mini' | 'o3-deep-research' | 'gemini-3-pro' | 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.0-flash' | 'gemini-2.5-pro' | 'claude-sonnet-4-5' | 'claude-opus-4-5' | 'claude-haiku-4-5' | 'claude-opus-4-1' | 'claude-sonnet-4-0' | 'claude-opus-4-0' | 'llama-4-scout-17b' | 'llama-4-maverick-17b' | 'mistral-small' | 'mistral-medium' | 'mistral-large' | 'magistral-medium' | 'magistral-small' | 'devstral-medium' | 'codestral' | 'qwen-qwq-32b' | 'grok-4-1-fast-reasoning' | 'grok-4-1-fast-non-reasoning' | 'grok-4-fast-reasoning' | 'grok-4-fast-non-reasoning' | 'grok-4' | 'grok-3' | 'grok-3-mini' | 'grok-code-fast' | 'solar-pro2';
/**
 * List of all available models
 */
declare const AVAILABLE_MODELS: readonly ModelType[];

/** 메시지 역할 타입 */
type MessageRole = "user" | "assistant" | "tool";
/** 채팅 타입 */
type ChatType = "NORMAL" | "DYNAMIC_CHAT";
/**
 * 대화 메시지
 */
interface Message {
    /** 메시지 역할 */
    role: MessageRole;
    /** 메시지 내용 */
    content: string;
    /** 도구 호출 ID (role이 'tool'일 때 필수) */
    tool_call_id?: string;
    /** 도구 이름 (role이 'tool'일 때 필수) */
    name?: string;
}
/**
 * 사용자 위치 정보
 */
interface UserLocation {
    /** 좌표 정보 */
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    /** 국가 코드 */
    country?: string;
    /** 국가명 */
    countryName?: string;
    /** 주/도 */
    state?: string;
    /** 표시 이름 */
    displayName?: string;
}
/**
 * 채팅 모델 노드 설정
 *
 * 서버의 MinimalChatModelNodeDto와 대응됩니다.
 *
 * @example
 * ```typescript
 * const modelNode: ChatModelNode = {
 *   model: 'gpt-5.1',
 *   instructions: '당신은 친절한 AI 어시스턴트입니다.',
 *   use_all_built_in_tools: true,
 *   output_type: 'TEXT',
 * };
 * ```
 */
interface ChatModelNode {
    /** 사용할 모델 (자동완성 지원) */
    model: ModelType;
    /** 시스템 지시사항 */
    instructions?: string;
    /** 모든 내장 도구 사용 여부 */
    use_all_built_in_tools?: boolean;
    /** 출력 형식 (TEXT 또는 JSON) */
    output_type?: "TEXT" | "JSON";
    /** JSON 출력 스키마 (output_type이 'JSON'일 때 사용) */
    output_schema?: Record<string, any> | null;
    /** 모델별 추가 속성 (temperature, max_tokens 등) */
    properties?: Record<string, any> | null;
    /** 사용할 내장 도구 ID 목록 */
    built_in_tools?: string[];
    /** 사용할 커스텀 도구 ID 목록 */
    custom_tool_ids?: string[];
    /** 사용할 MCP 서버 ID 목록 */
    mcp_server_ids?: string[];
    /** 사용할 RAG 스토리지 ID 목록 */
    rag_storage_ids?: string[];
}
/**
 * 채팅 완성 요청 파라미터
 */
interface CompletionRequest {
    /** 세션 ID (필수) */
    session_id: string;
    /** 대화 메시지 배열 (필수) */
    messages: Message[];
    /** 사전 구성된 모델 노드 ID (chat_model_node와 둘 중 하나 필수) */
    chat_model_node_id?: string;
    /** 인라인 모델 설정 (chat_model_node_id와 둘 중 하나 필수) */
    chat_model_node?: ChatModelNode;
    /** 채팅 타입 */
    chat_type?: ChatType;
    /** 사용자 메시지 ID */
    user_message_id?: string;
    /** 체크포인트 ID (대화 이어가기용) */
    checkpoint_id?: string;
    /** 파일 URL 목록 (이미지, 오디오 등) */
    files?: string[];
    /** 언어 설정 (예: 'ko', 'en') */
    locale?: string;
    /** 타임존 (예: 'Asia/Seoul') */
    timezone?: string;
    /** 사용자 위치 정보 */
    user_location?: UserLocation;
    /** 스트리밍 활성화 여부 */
    stream?: boolean;
    /** 모든 내장 도구 사용 여부 */
    use_all_built_in_tools?: boolean;
    /** 백그라운드 요약 사용 여부 */
    use_background_summarize?: boolean;
    /** 사고 과정 표시 여부 */
    thinking?: boolean;
}
/**
 * 도구 호출 정보
 */
interface ToolCall {
    /** 도구 호출 ID */
    tool_call_id: string;
    /** 도구 이름 */
    name: string;
    /** 도구 인자 */
    args: Record<string, unknown>;
}
/**
 * 체크포인트 설정 정보
 */
interface Configurable {
    /** 스레드 ID */
    thread_id: string;
    /** 체크포인트 네임스페이스 */
    checkpoint_ns: string;
    /** 체크포인트 ID */
    checkpoint_id: string;
}
/**
 * 비스트리밍 완성 응답
 *
 * 최종 응답 또는 도구 호출 요청 중 하나입니다.
 *
 * @example
 * ```typescript
 * const response = await client.chat.completions.create({
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   chat_model_node: { model: 'gpt-5.1' },
 * });
 *
 * if (response.type === 'final_response') {
 *   console.log('메시지:', response.message);
 *   console.log('사고 과정:', response.thinking);
 * } else if (response.type === 'tool_call_required') {
 *   console.log('필요한 도구:', response.tool_calls);
 * }
 * ```
 */
type CompletionResponse = {
    /** 최종 응답 타입 */
    type: "final_response";
    /** 세션 ID */
    session_id: string;
    /** AI의 응답 메시지 */
    message: string;
    /** AI의 사고 과정 */
    thinking: string;
    /** 도구 실행 결과 목록 */
    tool_results: Array<Record<string, unknown>>;
    /** 구조화된 출력 (output_type이 'JSON'일 때) */
    parsed: any;
} | {
    /** 도구 호출 요청 타입 */
    type: "tool_call_required";
    /** 세션 ID */
    session_id: string;
    /** 실행해야 할 도구 목록 */
    tool_calls: ToolCall[];
    /** 체크포인트 설정 정보 */
    configurable: Configurable;
    /** 사용자 메시지 ID */
    user_message_id: string;
};
/** 스트림 이벤트 타입 */
type StreamEventType = "token" | "thinking" | "tool_request" | "tool_result" | "progress" | "structured_output" | "tool_call_required" | "final_response" | "edit_chat_title" | "end" | "error";
/**
 * 스트리밍 이벤트
 *
 * @example
 * ```typescript
 * for await (const event of stream) {
 *   switch (event.type) {
 *     case 'token':
 *       process.stdout.write(event.content);
 *       break;
 *     case 'thinking':
 *       console.log('[사고 과정]', event.content);
 *       break;
 *     case 'final_response':
 *       console.log('완료:', event.message);
 *       break;
 *   }
 * }
 * ```
 */
type StreamEvent = {
    /** 토큰 이벤트 */
    type: "token";
    /** 생성된 텍스트 */
    content: string;
} | {
    /** 사고 과정 이벤트 */
    type: "thinking";
    /** 사고 내용 */
    content: string;
} | {
    /** 도구 요청 이벤트 (도구 호출 시작 시) */
    type: "tool_request";
    /** 도구 이름 */
    name: string;
    /** 도구 인자 */
    args: Record<string, unknown>;
    /** 도구 호출 ID */
    id: string;
} | {
    /** 도구 실행 결과 이벤트 */
    type: "tool_result";
    /** 도구 이름 */
    name: string;
    /** 실행 결과 */
    content: string;
    /** 도구 호출 ID */
    tool_call_id: string;
} | {
    /** 진행 상황 이벤트 */
    type: "progress";
    /** 진행 메시지 */
    content: string;
} | {
    /** 구조화된 출력 이벤트 */
    type: "structured_output";
    /** 출력 데이터 */
    output: unknown;
} | {
    /** 도구 호출 요청 이벤트 (수동 도구 실행 필요 시) */
    type: "tool_call_required";
    /** 세션 ID */
    session_id: string;
    /** 실행해야 할 도구 목록 */
    tool_calls: ToolCall[];
    /** 체크포인트 설정 정보 */
    configurable: Configurable;
} | {
    /** 최종 응답 이벤트 */
    type: "final_response";
    /** 세션 ID */
    session_id: string;
    /** AI의 응답 메시지 */
    message: string;
    /** AI의 사고 과정 */
    thinking: string;
    /** 구조화된 출력 (항상 null) */
    parsed: null;
    /** 도구 실행 결과 목록 */
    tool_results: Array<Record<string, unknown>>;
} | {
    /** 채팅 제목 수정 이벤트 */
    type: "edit_chat_title";
    /** 상태 */
    state: string;
    /** 생성된 제목 */
    message: string;
} | {
    /** 스트림 종료 이벤트 */
    type: "end";
} | {
    /** 오류 이벤트 */
    type: "error";
    /** 오류 메시지 */
    error: string;
};
/**
 * TimelyGPTClient 생성자 옵션
 */
interface TimelyGPTClientOptions {
    /** Timely GPT API 키 (환경변수 TIMELY_API_KEY 사용 가능) */
    apiKey?: string;
    /** API 베이스 URL (환경변수 TIMELY_BASE_URL 또는 기본값: 'https://hello.timelygpt.co.kr/api/v2/chat') */
    baseURL?: string;
}
/**
 * 인증 응답
 * @internal
 */
interface AuthResponse {
    success: boolean;
    data: {
        access_token: string;
    };
}
/**
 * 오류 응답
 * @internal
 */
interface ErrorResponse {
    success: false;
    error: string;
    message: string;
    statusCode: number;
}

/**
 * Server-Sent Events (SSE) 스트림을 처리하는 클래스
 *
 * AsyncIterable을 구현하여 for-await-of 루프로 스트림 이벤트를 처리할 수 있습니다.
 *
 * @example
 * ```typescript
 * const stream = await client.chat.completions.create({
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   chat_model_node: { model: 'gpt-5.1' },
 *   stream: true,
 * });
 *
 * for await (const event of stream) {
 *   if (event.type === 'token') {
 *     process.stdout.write(event.content);
 *   }
 * }
 * ```
 */
declare class Stream implements AsyncIterable<StreamEvent> {
    private response;
    constructor(response: Response);
    /**
     * 비동기 반복자를 반환합니다.
     *
     * @yields {StreamEvent} 스트림 이벤트
     * @throws {Error} 응답 본문이 null인 경우
     */
    [Symbol.asyncIterator](): AsyncIterator<StreamEvent>;
}

declare class Completions {
    private apiClient;
    private authManager;
    constructor(apiClient: APIClient, authManager: AuthManager);
    /**
     * 채팅 완성 요청을 생성합니다.
     *
     * @param params - 요청 파라미터
     * @param params.session_id - 세션 ID (필수)
     * @param params.messages - 대화 메시지 배열 (필수)
     * @param params.chat_model_node - 모델 설정 (chat_model_node_id와 둘 중 하나 필수)
     * @param params.chat_model_node_id - 사전 구성된 모델 노드 ID (chat_model_node와 둘 중 하나 필수)
     * @param params.stream - 스트리밍 활성화 여부 (기본값: false)
     * @param params.locale - 언어 설정 (예: 'ko', 'en')
     * @param params.timezone - 타임존 (예: 'Asia/Seoul')
     * @param params.checkpoint_id - 체크포인트 ID (대화 이어가기용)
     *
     * @returns 스트리밍 모드일 경우 Stream 객체, 아닐 경우 CompletionResponse
     *
     * @example
     * // 비스트리밍 요청
     * const response = await client.chat.completions.create({
     *   session_id: 'session_123',
     *   messages: [{ role: 'user', content: '안녕하세요' }],
     *   chat_model_node: { model: 'gpt-5.1' },
     *   stream: false
     * });
     *
     * @example
     * // 스트리밍 요청
     * const stream = await client.chat.completions.create({
     *   session_id: 'session_123',
     *   messages: [{ role: 'user', content: '안녕하세요' }],
     *   chat_model_node: { model: 'gpt-5.1' },
     *   stream: true
     * });
     *
     * for await (const event of stream) {
     *   if (event.type === 'token') {
     *     process.stdout.write(event.content);
     *   }
     * }
     *
     * @example
     * // 도구 호출 후 대화 이어가기
     * const finalResponse = await client.chat.completions.create({
     *   session_id: 'session_123',
     *   messages: toolResults,
     *   checkpoint_id: response.configurable.checkpoint_id,
     *   chat_model_node: { model: 'gpt-5.1' } // 이전과 동일한 설정 사용
     * });
     *
     * @throws {Error} chat_model_node_id와 chat_model_node가 모두 제공되지 않은 경우
     */
    create(params: CompletionRequest & {
        stream: true;
    }): Promise<Stream>;
    create(params: CompletionRequest & {
        stream?: false;
    }): Promise<CompletionResponse>;
}
declare class Chat {
    completions: Completions;
    constructor(apiClient: APIClient, authManager: AuthManager);
}

interface ExecutionLog {
    nodeId: string;
    nodeType: string;
    type: "start" | "complete" | "error" | "info" | "warning";
    message: string;
    timestamp: number;
    data?: any;
}
interface WorkflowExecutionState {
    isExecuting: boolean;
    executingNodes: Set<string>;
    completedNodes: Set<string>;
    failedNodes: Map<string, string>;
    nodeOutputs: Map<string, any>;
    globalState: Map<string, any>;
    logs: ExecutionLog[];
}
type ExecuteCodeCallback = (toolName: string, args: Record<string, any>, functionCode: string) => Promise<any>;
interface WorkflowContextOptions {
    addExecutionLog?: (logs: Omit<ExecutionLog, "timestamp">) => void;
    onNodeResult?: (nodeId: string, nodeType: string, data: any, message?: string) => void;
    executeCodeCallback?: ExecuteCodeCallback;
    baseURL?: string;
    getAccessToken?: () => Promise<string>;
}
declare class WorkflowExecutionContext {
    private _state;
    private _onNodeResultCallback?;
    executeCodeCallback?: ExecuteCodeCallback;
    baseURL?: string;
    getAccessToken?: () => Promise<string>;
    private _addExecutionLog?;
    constructor(options?: WorkflowContextOptions);
    onNodeResult(nodeId: string, nodeType: string, data: any, message?: string): void;
    get state(): {
        execution: WorkflowExecutionState;
    };
    resetExecution(): void;
}
type WorkflowContextType = WorkflowExecutionContext;
type AIWorkflowNodeDataCommon = {
    label: string;
    id?: string | null;
    inputBindings?: Record<string, string>;
};
type AIWorkflowResponseData = {
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
type WorkflowNodeType<NodeType extends string | undefined = string | undefined, NodeData extends Record<string, unknown> = Record<string, unknown>> = Node<NodeData & AIWorkflowNodeDataCommon, NodeType>;
type AIWorkflowNodeType<TNodeData = any> = WorkflowNodeType<string, {
    data: {
        nodeData: TNodeData;
    };
} & Record<string, any>>;
type AIWorkflowEdgeType = Edge<Record<string, unknown>, "custom">;

interface WorkflowResponse {
    success: boolean;
    status: number;
    data: AIWorkflowResponseData;
}
interface WorkflowListParams {
    limit?: number;
    offset?: number;
}
interface WorkflowListItem {
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
interface WorkflowListResponse {
    success: boolean;
    status: number;
    data: {
        workflows: WorkflowListItem[];
        total: number;
    };
}
interface RunWorkflowOptions {
    addExecutionLog?: WorkflowContextOptions["addExecutionLog"];
    executeCodeCallback?: WorkflowContextOptions["executeCodeCallback"];
}
interface WorkflowStartParams {
    schema: Record<string, any> | null;
    type: string;
}
interface CustomToolInfo {
    toolName: string;
    requestSchema: Record<string, any> | null;
    responseSchema: Record<string, any> | null;
    functionBody: string | null;
}
declare class Workflow {
    private apiClient;
    private authManager;
    private baseURL;
    constructor(apiClient: APIClient, authManager: AuthManager, baseURL: string);
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
    list(params?: WorkflowListParams): Promise<WorkflowListResponse>;
    /**
     * Fetch workflow data by workflow ID
     *
     * @param workflowId - Workflow ID to fetch
     * @returns Workflow data response
     */
    fetch(workflowId: string): Promise<WorkflowResponse["data"]["workflow_data"]>;
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
    getParams(workflowId: string): Promise<WorkflowStartParams>;
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
    getCustomTools(workflowId: string): Promise<CustomToolInfo[]>;
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
    run(workflowId: string, initialInputs: Record<string, any>, options?: RunWorkflowOptions): Promise<any>;
}

/**
 * 워크플로우 실행 엔진
 * @template TNodeType - The node type to use (must extend AIWorkflowNodeType)
 */
declare function executeWorkflow<TNodeType extends AIWorkflowNodeType = AIWorkflowNodeType>(nodes: TNodeType[], edges: AIWorkflowEdgeType[], context: WorkflowContextType, initialInputs?: Record<string, any>): Promise<any>;

/**
 * Timely GPT API 클라이언트
 *
 * OpenAI SDK 스타일의 인터페이스로 Timely GPT API를 사용할 수 있습니다.
 *
 * @example
 * ```typescript
 * import { TimelyGPTClient } from '@timely/gpt-sdk';
 *
 * const client = new TimelyGPTClient({
 *   apiKey: 'sdk_live_your_api_key_here',
 *   baseURL: 'https://hello.timelygpt.co.kr/api/v2/chat',
 * });
 *
 * // 비스트리밍 요청
 * const response = await client.chat.completions.create({
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   chat_model_node: { model: 'gpt-5.1' },
 * });
 *
 * // 스트리밍 요청
 * const stream = await client.chat.completions.create({
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   chat_model_node: { model: 'gpt-5.1' },
 *   stream: true,
 * });
 *
 * for await (const event of stream) {
 *   if (event.type === 'token') {
 *     console.log(event.content);
 *   }
 * }
 * ```
 */
declare class TimelyGPTClient {
    /** 채팅 완성 API */
    chat: Chat;
    /** 워크플로우 API */
    workflow: Workflow;
    private authManager;
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
    constructor(options?: TimelyGPTClientOptions);
}

export { type AIWorkflowEdgeType, type AIWorkflowNodeType, APIError, AVAILABLE_MODELS, type AuthResponse, type ChatModelNode, type ChatType, type CompletionRequest, type CompletionResponse, type Configurable, type CustomToolInfo, type ErrorResponse, type ExecuteCodeCallback, type ExecutionLog, type Message, type MessageRole, type ModelType, type RunWorkflowOptions, Stream, type StreamEvent, type StreamEventType, TimelyGPTClient, type TimelyGPTClientOptions, type ToolCall, type UserLocation, WorkflowExecutionContext as WorkflowContext, type WorkflowContextOptions, type WorkflowExecutionState, type WorkflowListItem, type WorkflowListParams, type WorkflowListResponse, type WorkflowResponse, type WorkflowStartParams, TimelyGPTClient as default, executeWorkflow };
