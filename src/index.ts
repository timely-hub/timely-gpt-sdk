import { APIClient } from "./core/api-client";
import { AuthManager } from "./core/auth";
import { Chat } from "./resources/chat";
import type { TimelyGPTClientOptions } from "./types";

export { APIError } from "./core/api-client";
export { Stream } from "./core/stream";
export * from "./types";

// Export generated model types (optional - will be available after running generate-models)
export { AVAILABLE_MODELS } from "./generated/models";
export type { ModelType } from "./generated/models";

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
export class TimelyGPTClient {
  /** 채팅 완성 API */
  public chat: Chat;
  private authManager: AuthManager;

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
  constructor(options: TimelyGPTClientOptions = {}) {
    const apiKey = options.apiKey || process.env.TIMELY_API_KEY;
    const baseURL =
      options.baseURL ||
      process.env.TIMELY_BASE_URL ||
      "https://hello.timelygpt.co.kr/api/v2/chat";

    if (!apiKey) {
      throw new Error(
        "API key is required. Provide it via options.apiKey or TIMELY_API_KEY environment variable."
      );
    }

    this.authManager = new AuthManager(apiKey, baseURL);
    const apiClient = new APIClient(baseURL);

    this.chat = new Chat(apiClient, this.authManager);
  }
}

export default TimelyGPTClient;
