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
 */
export interface CompletionRequest {
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
