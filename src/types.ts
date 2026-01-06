import type { ModelType } from "./generated/models";

/** 메시지 역할 타입 */
export type MessageRole = "user" | "assistant" | "tool";

/** 채팅 타입 */
export type ChatType = "NORMAL" | "DYNAMIC_CHAT";

/**
 * 대화 메시지
 */
export interface Message {
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
export interface UserLocation {
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
 * Remote MCP 도구
 */
export interface RemoteMcpTool {
  /** 도구 타입 */
  type: "mcp";
  /** MCP 서버 라벨 */
  server_label: string;
  /** MCP 서버 설명 */
  server_description?: string;
  /** MCP 서버 URL */
  server_url: string;
  /** 승인 요구 수준 */
  require_approval?: "always" | "never" | "auto";
  /** 허용된 도구 목록 */
  allowed_tools?: string[];
  /** HTTP 헤더 */
  headers?: Record<string, string>;
}

/**
 * 커스텀 도구 참조
 */
export interface CustomToolReference {
  /** 도구 타입 */
  type: "custom_tool_reference";
  /** 커스텀 도구 ID */
  custom_tool_id: string;
}

export interface McpServerReference {
  /** 도구 타입 */
  type: "mcp_server_reference";
  /** MCP 서버 ID */
  mcp_server_id: string;
}

/**
 * Function 도구
 */
export interface FunctionTool {
  /** 도구 타입 */
  type: "function";
  /** 함수 이름 */
  name: string;
  /** 함수 설명 */
  description?: string;
  /** 함수 파라미터 스키마 */
  parameters: Record<string, any>;
}

/**
 * 내장 도구
 */
export interface BuiltInTool {
  /** 도구 타입 */
  type: "built_in";
  /** 내장 도구 ID */
  tool_id: string;
}

/**
 * 도구 타입 (통합)
 */
export type Tool = RemoteMcpTool | CustomToolReference | FunctionTool | BuiltInTool | McpServerReference;

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
export interface ChatModelNode {
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
 *
 * @example
 * ```typescript
 * // 새로운 tools 배열 사용 (권장)
 * const request: CompletionRequest = {
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   model: 'gpt-4o-mini',
 *   tools: [
 *     { type: 'built_in', tool_id: 'web_search' },
 *     { type: 'custom_tool_reference', custom_tool_id: 'my_tool' },
 *     {
 *       type: 'mcp',
 *       server_label: 'my-server',
 *       server_url: 'https://mcp.example.com',
 *       require_approval: 'auto'
 *     }
 *   ]
 * };
 *
 * // 레거시 필드 사용 (하위 호환성)
 * const legacyRequest: CompletionRequest = {
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   model: 'gpt-4o-mini',
 *   built_in_tools: ['web_search'],
 *   custom_tool_ids: ['my_tool']
 * };
 * ```
 */
export interface CompletionRequest {
  /** 세션 ID (필수) */
  session_id: string;
  /** 대화 메시지 배열 (필수) */
  messages: Message[];
  /** 모델 설정 (필수) */
  model: string;
  /** 시스템 지시사항 */
  instructions?: string;
  /** 출력 형식 (TEXT 또는 JSON) */
  output_type?: "TEXT" | "JSON";
  /** JSON 출력 스키마 (output_type이 'JSON'일 때 사용) */
  output_schema?: Record<string, any> | null;
  /** 모델별 추가 속성 (temperature, max_tokens 등) */
  properties?: Record<string, any> | null;

  /** 도구 목록 (Built-in, Remote MCP, Custom Tool 참조, Function) */
  tools?: Tool[];

  /**
   * @deprecated tools 배열을 사용하세요
   * 사용할 내장 도구 ID 목록
   */
  built_in_tools?: string[];
  /**
   * @deprecated tools 배열을 사용하세요
   * 사용할 커스텀 도구 ID 목록
   */
  custom_tool_ids?: string[];
  /**
   * @deprecated tools 배열을 사용하세요
   * 사용할 MCP 서버 ID 목록
   */
  mcp_server_ids?: string[];

  /** 사용할 RAG 스토리지 ID 목록 */
  rag_storage_ids?: string[];
  /** 채팅 타입 */
  chat_type?: ChatType;
  /** 사용자 메시지 ID */
  user_message_id?: string;
  /** 체크포인트 ID (대화 이어가기용) */
  checkpoint_id?: string | null;
  /** 파일 URL 목록 (이미지, 오디오 등) */
  files?: string[];
  /** 언어 설정 (예: 'ko', 'en') */
  locale?: string;
  /** 타임존 (예: 'Asia/Seoul') */
  timezone?: string;
  /** 사용자 위치 정보 */
  user_location?: UserLocation | null;
  /** 스트리밍 활성화 여부 */
  stream?: boolean;
  /** 모든 내장 도구 사용 여부 */
  use_all_built_in_tools?: boolean;
  /** 백그라운드 요약 사용 여부 */
  use_background_summarize?: boolean;
  /** 사고 과정 표시 여부 */
  thinking?: boolean;
  /** 대화 기록 사용 여부 */
  never_use_history?: boolean;
}

/**
 * 도구 호출 정보
 */
export interface ToolCall {
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
export interface Configurable {
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
 *   model: 'gpt-5.1',
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
export type CompletionResponse =
  | {
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
    }
  | {
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
export type StreamEventType =
  | "token"
  | "thinking"
  | "tool_request"
  | "tool_result"
  | "progress"
  | "structured_output"
  | "tool_call_required"
  | "final_response"
  | "edit_chat_title"
  | "end"
  | "error";

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
export type StreamEvent =
  | {
      /** 토큰 이벤트 */
      type: "token";
      /** 생성된 텍스트 */
      content: string;
    }
  | {
      /** 사고 과정 이벤트 */
      type: "thinking";
      /** 사고 내용 */
      content: string;
    }
  | {
      /** 도구 요청 이벤트 (도구 호출 시작 시) */
      type: "tool_request";
      /** 도구 이름 */
      name: string;
      /** 도구 인자 */
      args: Record<string, unknown>;
      /** 도구 호출 ID */
      id: string;
    }
  | {
      /** 도구 실행 결과 이벤트 */
      type: "tool_result";
      /** 도구 이름 */
      name: string;
      /** 실행 결과 */
      content: string;
      /** 도구 호출 ID */
      tool_call_id: string;
    }
  | {
      /** 진행 상황 이벤트 */
      type: "progress";
      /** 진행 메시지 */
      content: string;
    }
  | {
      /** 구조화된 출력 이벤트 */
      type: "structured_output";
      /** 출력 데이터 */
      output: unknown;
    }
  | {
      /** 도구 호출 요청 이벤트 (수동 도구 실행 필요 시) */
      type: "tool_call_required";
      /** 세션 ID */
      session_id: string;
      /** 실행해야 할 도구 목록 */
      tool_calls: ToolCall[];
      /** 체크포인트 설정 정보 */
      configurable: Configurable;
    }
  | {
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
    }
  | {
      /** 채팅 제목 수정 이벤트 */
      type: "edit_chat_title";
      /** 상태 */
      state: string;
      /** 생성된 제목 */
      message: string;
    }
  | {
      /** 스트림 종료 이벤트 */
      type: "end";
    }
  | {
      /** 오류 이벤트 */
      type: "error";
      /** 오류 메시지 */
      error: string;
    };

/**
 * TimelyGPTClient 생성자 옵션
 */
export interface TimelyGPTClientOptions {
  /** Timely GPT API 키 (환경변수 TIMELY_API_KEY 사용 가능) */
  apiKey?: string;
  /** API 베이스 URL (환경변수 TIMELY_BASE_URL 또는 기본값: 'https://hello.timelygpt.co.kr/api/v2/chat') */
  baseURL?: string;
}

/**
 * 인증 응답
 * @internal
 */
export interface AuthResponse {
  success: boolean;
  data: {
    access_token: string;
  };
}

/**
 * 오류 응답
 * @internal
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}

/**
 * 레거시 도구 설정을 새로운 tools 배열로 변환하는 헬퍼 함수
 *
 * @param options - 레거시 도구 옵션
 * @returns Tool 배열
 *
 * @example
 * ```typescript
 * const tools = convertLegacyToolsToArray({
 *   built_in_tools: ['web_search', 'calculator'],
 *   custom_tool_ids: ['my_tool_1', 'my_tool_2'],
 * });
 *
 * const request: CompletionRequest = {
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   model: 'gpt-4o-mini',
 *   tools,
 * };
 * ```
 */
export function convertLegacyToolsToArray(options: {
  built_in_tools?: string[];
  custom_tool_ids?: string[];
  mcp_server_ids?: string[];
}): Tool[] {
  const tools: Tool[] = [];

  if (options.built_in_tools) {
    tools.push(
      ...options.built_in_tools.map(
        (id): BuiltInTool => ({
          type: "built_in",
          tool_id: id,
        })
      )
    );
  }

  if (options.custom_tool_ids) {
    tools.push(
      ...options.custom_tool_ids.map(
        (id): CustomToolReference => ({
          type: "custom_tool_reference",
          custom_tool_id: id,
        })
      )
    );
  }

  // mcp_server_ids는 더 이상 직접적으로 지원되지 않으며
  // RemoteMcpTool을 직접 구성해야 합니다
  if (options.mcp_server_ids && options.mcp_server_ids.length > 0) {
    tools.push(
      ...options.mcp_server_ids.map(
        (id): McpServerReference => ({
          type: "mcp_server_reference",
          mcp_server_id: id,
        })
      )
    );
    console.warn(
      "mcp_server_ids는 더 이상 지원되지 않습니다. RemoteMcpTool을 직접 구성하세요."
    );
  }

  return tools;
}

/**
 * CompletionRequest에서 레거시 필드를 새로운 tools 배열로 자동 변환
 *
 * @param request - 원본 요청
 * @returns 변환된 요청
 *
 * @example
 * ```typescript
 * const legacyRequest: CompletionRequest = {
 *   session_id: 'session_123',
 *   messages: [{ role: 'user', content: '안녕하세요' }],
 *   model: 'gpt-4o-mini',
 *   built_in_tools: ['web_search'],
 *   custom_tool_ids: ['my_tool']
 * };
 *
 * // 레거시 필드를 tools 배열로 변환
 * const modernRequest = normalizeCompletionRequest(legacyRequest);
 * ```
 */
export function normalizeCompletionRequest(
  request: CompletionRequest
): CompletionRequest {
  // tools 배열이 이미 있으면 그대로 반환
  if (request.tools && request.tools.length > 0) {
    return request;
  }

  // 레거시 필드가 있으면 변환 (하위 호환성)
  if (
    request.built_in_tools ||
    request.custom_tool_ids ||
    request.mcp_server_ids
  ) {
    const tools = convertLegacyToolsToArray({
      built_in_tools: request.built_in_tools,
      custom_tool_ids: request.custom_tool_ids,
      mcp_server_ids: request.mcp_server_ids,
    });

    // 레거시 필드 제거 및 tools 배열 추가
    const { built_in_tools, custom_tool_ids, mcp_server_ids, ...rest } =
      request;

    return {
      ...rest,
      tools,
    };
  }

  return request;
}
