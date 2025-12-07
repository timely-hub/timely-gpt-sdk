import { APIClient } from "../core/api-client";
import { AuthManager } from "../core/auth";
import { Stream } from "../core/stream";
import type { CompletionRequest, CompletionResponse } from "../types";

export class Completions {
  private apiClient: APIClient;
  private authManager: AuthManager;

  constructor(apiClient: APIClient, authManager: AuthManager) {
    this.apiClient = apiClient;
    this.authManager = authManager;
  }

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
  async create(params: CompletionRequest & { stream: true }): Promise<Stream>;
  async create(
    params: CompletionRequest & { stream?: false }
  ): Promise<CompletionResponse>;
  async create(
    params: CompletionRequest
  ): Promise<CompletionResponse | Stream> {
    if (!params.chat_model_node_id && !params.chat_model_node) {
      throw new Error(
        "Either chat_model_node_id or chat_model_node must be provided"
      );
    }

    // chat_type 검증
    const chatType = params.chat_type || "DYNAMIC_CHAT";
    if (chatType !== "NORMAL" && chatType !== "DYNAMIC_CHAT") {
      throw new Error(
        `Invalid chat_type: ${chatType}. Only "NORMAL" and "DYNAMIC_CHAT" are allowed.`
      );
    }

    // chat_type 기본값을 DYNAMIC_CHAT으로 설정
    const requestParams = {
      ...params,
      chat_type: chatType,
    };

    const accessToken = await this.authManager.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
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

    return this.apiClient.post<CompletionResponse>(
      "/llm-completion",
      requestParams,
      headers
    );
  }
}

export class Chat {
  public completions: Completions;

  constructor(apiClient: APIClient, authManager: AuthManager) {
    this.completions = new Completions(apiClient, authManager);
  }
}
