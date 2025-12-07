// src/core/api-client.ts
var APIError = class extends Error {
  constructor(message, statusCode, error) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.name = "APIError";
  }
};
var APIClient = class {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        throw new APIError(
          `HTTP error ${response.status}: ${response.statusText}`,
          response.status
        );
      }
      throw new APIError(
        errorData.message || `HTTP error ${response.status}`,
        errorData.statusCode || response.status,
        errorData.error
      );
    }
    return response.json();
  }
  async get(endpoint, headers) {
    return this.request(endpoint, {
      method: "GET",
      headers
    });
  }
  async post(endpoint, body, headers) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers
    });
  }
  async streamPost(endpoint, body, headers) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        throw new APIError(
          `HTTP error ${response.status}: ${response.statusText}`,
          response.status
        );
      }
      throw new APIError(
        errorData.message || `HTTP error ${response.status}`,
        errorData.statusCode || response.status,
        errorData.error
      );
    }
    return response;
  }
};

// src/core/auth.ts
var AuthManager = class {
  constructor(apiKey, baseURL) {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.apiKey = apiKey;
    this.apiClient = new APIClient(baseURL);
  }
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    await this.authenticate();
    return this.accessToken;
  }
  async authenticate() {
    const response = await this.apiClient.get(
      "/sdk-auth/authenticate",
      {
        "X-Timely-API": this.apiKey
      }
    );
    if (!response.success || !response.data.access_token) {
      throw new Error("Failed to authenticate with API key");
    }
    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + 55 * 60 * 1e3;
  }
  clearToken() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
};

// src/core/stream.ts
var Stream = class {
  constructor(response) {
    this.response = response;
  }
  /**
   * 비동기 반복자를 반환합니다.
   *
   * @yields {StreamEvent} 스트림 이벤트
   * @throws {Error} 응답 본문이 null인 경우
   */
  async *[Symbol.asyncIterator]() {
    if (!this.response.body) {
      throw new Error("Response body is null");
    }
    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const event = JSON.parse(data);
            yield event;
            if (event.type === "end" || event.type === "error") {
              return;
            }
          } catch (error) {
            console.error("Failed to parse SSE data:", data, error);
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
};

// src/resources/chat.ts
var Completions = class {
  constructor(apiClient, authManager) {
    this.apiClient = apiClient;
    this.authManager = authManager;
  }
  async create(params) {
    if (!params.chat_model_node_id && !params.chat_model_node) {
      throw new Error(
        "Either chat_model_node_id or chat_model_node must be provided"
      );
    }
    const chatType = params.chat_type || "DYNAMIC_CHAT";
    if (chatType !== "NORMAL" && chatType !== "DYNAMIC_CHAT") {
      throw new Error(
        `Invalid chat_type: ${chatType}. Only "NORMAL" and "DYNAMIC_CHAT" are allowed.`
      );
    }
    const requestParams = {
      ...params,
      chat_type: chatType
    };
    const accessToken = await this.authManager.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`
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
    return this.apiClient.post(
      "/llm-completion",
      requestParams,
      headers
    );
  }
};
var Chat = class {
  constructor(apiClient, authManager) {
    this.completions = new Completions(apiClient, authManager);
  }
};

// src/generated/models.ts
var AVAILABLE_MODELS = [
  "gpt-5.1",
  "gpt-5.1 chat",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-o4-mini",
  "gpt-o3",
  "gpt-5.1-codex",
  "gpt-5.1-codex-mini",
  "gpt-5-codex",
  "codex-mini",
  "gemini-3-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-1",
  "claude-sonnet-4-0",
  "claude-opus-4-0",
  "llama-4-scout-17b",
  "llama-4-maverick-17b",
  "mistral-small",
  "mistral-medium",
  "mistral-large",
  "magistral-medium",
  "magistral-small",
  "devstral-medium",
  "codestral",
  "qwen-qwq-32b",
  "grok-4-1-fast-non-reasoning",
  "grok-4-fast-reasoning",
  "grok-4-fast-non-reasoning",
  "grok-4",
  "grok-3",
  "grok-3-mini",
  "grok-code-fast",
  "solar-pro2"
];

// src/index.ts
var TimelyGPTClient = class {
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
  constructor(options = {}) {
    const apiKey = options.apiKey || process.env.TIMELY_API_KEY;
    const baseURL = options.baseURL || process.env.TIMELY_BASE_URL || "https://hello.timelygpt.co.kr/api/v2/chat";
    if (!apiKey) {
      throw new Error(
        "API key is required. Provide it via options.apiKey or TIMELY_API_KEY environment variable."
      );
    }
    this.authManager = new AuthManager(apiKey, baseURL);
    const apiClient = new APIClient(baseURL);
    this.chat = new Chat(apiClient, this.authManager);
  }
};
var index_default = TimelyGPTClient;
export {
  APIError,
  AVAILABLE_MODELS,
  Stream,
  TimelyGPTClient,
  index_default as default
};
