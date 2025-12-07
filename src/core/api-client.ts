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
export class APIError extends Error {
  constructor(
    message: string,
    /** HTTP 상태 코드 */
    public statusCode: number,
    /** 오류 타입 */
    public error?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Fetch 옵션
 * @internal
 */
export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * HTTP API 클라이언트
 * @internal
 */
export class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: any;
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

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  async post<T>(
    endpoint: string,
    body: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  }

  async streamPost(
    endpoint: string,
    body: any,
    headers?: Record<string, string>
  ): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorData: any;
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
}
