import type { StreamEvent } from '../types';

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
 *   model: 'gpt-5.1',
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
export class Stream implements AsyncIterable<StreamEvent> {
  private response: Response;

  constructor(response: Response) {
    this.response = response;
  }

  /**
   * 비동기 반복자를 반환합니다.
   *
   * @yields {StreamEvent} 스트림 이벤트
   * @throws {Error} 응답 본문이 null인 경우
   */
  async *[Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    if (!this.response.body) {
      throw new Error('Response body is null');
    }

    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6);

          if (data === '[DONE]') {
            return;
          }

          let event: StreamEvent;
          try {
            event = JSON.parse(data) as StreamEvent;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            yield {
              type: 'error',
              error: `Failed to parse SSE event: ${message}`,
            } as StreamEvent;
            return;
          }

          yield event;

          if (event.type === 'end' || event.type === 'error') {
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
