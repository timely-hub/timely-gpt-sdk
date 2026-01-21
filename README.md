# Timely GPT SDK

Timely GPT API를 위한 공식 TypeScript/JavaScript SDK입니다. OpenAI SDK와 유사한 직관적인 인터페이스로 스트리밍을 지원하는 AI 기반 애플리케이션을 구축할 수 있습니다.

> **💡 OpenAI SDK 또는 LangChain을 직접 사용하시나요?**
> OpenAI SDK나 LangChain을 직접 사용하여 다양한 AI 모델을 이용하려면 **[OpenAI SDK 사용 가이드](./OPENAI_SDK_GUIDE.md)** 를 참고하세요.
> **주의**: OpenAI 호환 모드에서 사용 가능한 모델 목록과 모델명은 이 SDK와 다릅니다.

## 문서

- 📚 **REST API 문서**: [https://hello.timelygpt.co.kr/api/v2/chat/sdk](https://hello.timelygpt.co.kr/api/v2/chat/sdk)
- 🔌 **OpenAI SDK 사용 가이드**: [OPENAI_SDK_GUIDE.md](./OPENAI_SDK_GUIDE.md)
- 📦 **GitHub 저장소**: [https://github.com/timely-hub/timely-gpt-sdk](https://github.com/timely-hub/timely-gpt-sdk)
- 🐛 **Issue 트래킹**: [https://github.com/timely-hub/timely-gpt-sdk/issues](https://github.com/timely-hub/timely-gpt-sdk/issues)

## 주요 기능

- 🚀 **OpenAI 스타일 API** - 친숙한 인터페이스로 쉽게 도입 가능
- 🔄 **스트리밍 지원** - SSE 기반 실시간 토큰 스트리밍
- 🎯 **타입 안전성** - TypeScript 지원
- 🔐 **자동 인증** - JWT 토큰 관리 자동 처리
- 📦 **제로 의존성** - 네이티브 fetch API만 사용
- 🛠️ **도구 호출** - 내장 및 커스텀 도구 지원
- ⚡ **워크플로우 실행** - Timely GPT에서 생성한 에이전트 워크플로우 실행 및 관리

## 설치

### GitHub에서 직접 설치 (권장)

```bash
npm install git+https://github.com/timely-hub/timely-gpt-sdk.git
```

또는 package.json에 추가:

```json
{
  "dependencies": {
    "@timely/gpt-sdk": "git+https://github.com/timely-hub/timely-gpt-sdk.git"
  }
}
```

### NPM 패키지 (추후 제공 예정)

```bash
npm install @timely/gpt-sdk
```

## 빠른 시작

### 세션 ID (선택 사항)

세션 ID는 대화 컨텍스트를 유지하기 위한 **식별자**입니다.

세션 ID가 동일하면:
- ✅ **대화 기록 유지**: 이전 대화 내용을 기억하고 맥락 있는 응답 제공
- ✅ **개인화된 경험**: 사용자별 대화 흐름 관리

세션 ID가 없으면:
- ❌ AI가 이전 대화를 기억하지 못함
- ❌ 모든 요청이 새로운 대화로 처리됨

#### 올바른 사용법

```typescript
// ✅ 사용자별로 고유한 세션 ID 사용
const sessionId = `user_${userId}_${conversationId}`;

// ✅ UUID 사용 (새 대화 시작 시 한 번만 생성)
import { randomUUID } from 'crypto';
const sessionId = randomUUID();

// ✅ 기존 세션 ID 재사용 (대화 이어가기)
const sessionId = existingSessionId;
```

#### 잘못된 사용법

```typescript
// ❌ 매번 새로운 ID 생성 - 대화 컨텍스트가 유지되지 않음
const sessionId = 'session_' + Date.now();

// ❌ 요청마다 랜덤 ID - 모든 대화가 처음부터 시작됨
const sessionId = Math.random().toString();
```

### 기본 비스트리밍 예제

```typescript
import { TimelyGPTClient } from '@timely/gpt-sdk';

// 환경변수 사용 (권장)
const client = new TimelyGPTClient();

// 또는 직접 지정
const client = new TimelyGPTClient({
  apiKey: 'sdk_live_your_api_key_here',
  baseURL: 'https://hello.timelygpt.co.kr/api/v2/chat',
});

// 세션 ID는 사용자별로 고유하게 관리 (예: 사용자 ID, UUID 등)
const sessionId = 'user_123_session';

const response = await client.chat.completions.create({
  session_id: sessionId,
  messages: [
    { role: 'user', content: '안녕하세요!' }
  ],
  model: 'gpt-5.1',
  instructions: '당신은 친절한 AI 어시스턴트입니다.',
  locale: 'ko',
});

// 응답 타입에 따라 처리
if (response.type === 'final_response') {
  console.log('메시지:', response.message);
  console.log('사고 과정:', response.thinking);
} else if (response.type === 'tool_call_required') {
  console.log('필요한 도구:', response.tool_calls);
}
```

### 스트리밍 예제

```typescript
// 동일한 세션 ID로 대화를 이어갈 수 있습니다
const sessionId = 'user_123_session';

const stream = await client.chat.completions.create({
  session_id: sessionId,
  messages: [
    { role: 'user', content: '프로그래밍에 대해 설명해주세요' }
  ],
  model: 'gpt-5.1',
  instructions: '당신은 친절한 AI 어시스턴트입니다.',
  stream: true,
  locale: 'ko',
});

for await (const event of stream) {
  switch (event.type) {
    case 'token':
      process.stdout.write(event.content);
      break;
    case 'thinking':
      console.log('\n[Thinking]', event.content);
      break;
    case 'final_response':
      console.log('\n\nDone!');
      console.log('Session:', event.session_id);
      break;
    case 'error':
      console.error('Error:', event.error);
      break;
  }
}
```

## API 레퍼런스

### TimelyGPTClient

#### 생성자

```typescript
new TimelyGPTClient(options?: TimelyGPTClientOptions)
```

**옵션 (모두 선택사항):**
- `apiKey`: SDK API 키 (환경변수 `TIMELY_API_KEY` 사용 가능)
- `baseURL`: API 베이스 URL (환경변수 `TIMELY_BASE_URL` 또는 기본값: `https://hello.timelygpt.co.kr/api/v2/chat`)

**환경변수를 사용하는 경우:**
```typescript
// .env 파일 또는 환경변수 설정
// TIMELY_API_KEY=sdk_live_your_api_key_here
// TIMELY_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat

const client = new TimelyGPTClient(); // 모든 값이 환경변수에서 로드됨
```

### 채팅 완성

#### `client.chat.completions.create(params)`


채팅 완성 요청을 생성합니다.

**파라미터:**

```typescript
interface CompletionRequest {
  session_id: string;                    // 필수: 세션 ID
  messages: Message[];                   // 필수: 대화 메시지
  model: string;                         // 필수: 모델 설정
  instructions: string;                  // 선택: 사용자 지침
  output_type: 'TEXT' | 'JSON'; 
  output_schema: Record<string, any>
  properties: Record<string, any>
  rag_storage_ids: string[]
  stream?: boolean;                      // 선택: 스트리밍 활성화 (기본값: false)
  locale?: string;                       // 선택: 언어 (기본값: 'ko')
  timezone?: string;                     // 선택: 타임존 (예: 'Asia/Seoul')
  thinking?: boolean;                    // 선택: 사고 과정 표시 모드
  tools: (RemoteMcpToolDto | FunctionToolDto | BuiltInToolDto)[]
  use_background_summarize?: boolean;    // 선택: 백그라운드 요약 (롱텀 컨텍스트 유지)
  checkpoint_id?: string;                // 선택: 체크포인트에서 재개
  files?: string[];                      // 선택: 파일 URL (이미지, 오디오)
  user_location?: UserLocation;          // 선택: 사용자 위치 데이터
}

interface RemoteMcpToolDto {
  /** 도구 타입 */
  type: 'mcp';
  /** 원본 McpServerNode ID (있으면 참조 추적용) */
  id?: string;
  /** MCP 서버 이름 */
  name: string;
  /** MCP 서버 설명 */
  description?: string;
  /** MCP 서버 URL (SSE 엔드포인트) */
  url: string;
  /** 전송 방식 (stdio, sse 등) */
  transport?: string;
  /** 도구 실행 승인 요구 여부 (기본값: 'never') */
  require_approval?: 'always' | 'never' | 'auto';
  /** 허용할 도구 이름 목록 (미지정 시 전체 허용) */
  allowed_tools?: string[];
  /** 요청 헤더 (인증 토큰 등) */
  headers?: Record<string, string>;
}
/**
 * Function 도구 (OpenAI 호환, 클라이언트에서 실행)
 */
interface FunctionToolDto {
  /** 도구 타입 */
  type: 'function';
  /** 원본 CustomToolNode ID (있으면 참조 추적용) */
  id?: string;
  /** 함수 이름 */
  name: string;
  /** 함수 설명 */
  description?: string;
  /** JSONSchema 입력 스키마 */
  schema: Record<string, any>;
  /** 함수 본문 (동적 실행용) */
  function_body?: string;
  /** 응답 스키마 */
  response_schema?: Record<string, any>;
}
/**
 * Built-in 도구 참조
 */
interface BuiltInToolDto {
  /** 도구 타입 */
  type: 'built_in';
  /** Built-in 도구 ID (예: web_search, code_interpreter, all_tools) */
  id: string;
}
```

**메시지 형식:**

```typescript
interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;  // tool 역할일 때 필수
  name?: string;          // tool 역할일 때 필수
}
```

**채팅 모델 노드:**

```typescript
interface ChatModelNode {
  model: ModelType;                      // 모델 이름 (자동완성 지원)
  instructions?: string;                 // 시스템 지시사항
  tools: (RemoteMcpToolDto | FunctionToolDto | BuiltInToolDto)[]
  output_type?: 'TEXT' | 'JSON';         // 출력 형식
  output_schema?: Record<string, any>;   // JSON 출력 스키마
  properties?: Record<string, any>;      // 모델별 추가 속성
  rag_storage_ids?: string[];            // RAG 스토리지 ID
}
```

### 응답 타입

#### 비스트리밍 응답

```typescript
type CompletionResponse =
  | {
      type: 'final_response';
      session_id: string;
      message: string;
      thinking: string;
      tool_results: Array<Record<string, unknown>>;
      parsed: any;  // 요청한 경우 구조화된 출력
    }
  | {
      type: 'tool_call_required';
      session_id: string;
      tool_calls: ToolCall[];
      configurable: Configurable;
      user_message_id: string;
    };
```

#### 스트리밍 이벤트

```typescript
type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'thinking'; content: string }
  | {
      type: 'tool_request';
      name: string;
      args: Record<string, unknown>;
      id: string;
    }
  | {
      type: 'tool_result';
      name: string;
      content: string;
      tool_call_id: string;
    }
  | { type: 'progress'; content: string }
  | { type: 'structured_output'; output: unknown }
  | {
      type: 'tool_call_required';
      session_id: string;
      tool_calls: ToolCall[];
      configurable: Configurable;
    }
  | {
      type: 'final_response';
      session_id: string;
      message: string;
      thinking: string;
      tool_results: Array<Record<string, unknown>>;
      parsed: null;
    }
  | {
      type: 'edit_chat_title';
      state: string;
      message: string;
    }
  | { type: 'end' }
  | { type: 'error'; error: string };
```

## 워크플로우

워크플로우를 사용하면 복잡한 AI 작업을 시각적으로 구성하고 실행할 수 있습니다.

### 워크플로우 목록 조회

```typescript
const workflows = await client.workflow.list();
console.log(`Total: ${workflows.data.total}`);

workflows.data.workflows.forEach(workflow => {
  console.log(`${workflow.name} (${workflow.workflow_id})`);
});
```

### 워크플로우 실행 시작 파라미터 확인
- 워크플로우 실행 시작 파라미터는 워크플로우 생성 시 설정한 START 노드의 파라미터를 반환합니다.

```typescript
const params = await client.workflow.getParams('workflow_id');
console.log('Schema:', params.schema);
console.log('Type:', params.type);
```

### 커스텀 도구 정보 추출
- 워크플로우 생성 시 설정한 커스텀 도구가 있다면, 커스텀 도구의 정보를 반환합니다.
- 워크플로우 실행시 도구 실행을 콜백으로 전달할 수 있습니다.

```typescript
const customTools = await client.workflow.getCustomTools('workflow_id');

customTools.forEach(tool => {
  console.log(`Tool: ${tool.toolName}`);
  console.log('Request Schema:', tool.requestSchema);
  console.log('Response Schema:', tool.responseSchema);
});
```

### 워크플로우 실행

```typescript
const result = await client.workflow.run(
  'workflow_id',
  { input: 'your input data' }, // 워크플로우 실행 시작 파라미터
  {
    addExecutionLog: (log) => console.log(log.message), // 워크플로우 실행 로그
    executeCodeCallback: async (toolName, args, code) => { // 커스텀 도구 실행 콜백
      // Custom code execution
      return eval(code);
    }
  }
);
```

## 예제

[examples](./examples) 디렉토리를 참고하세요:

- **[basic.ts](./examples/basic.ts)** - 기본 비스트리밍 예제
- **[streaming.ts](./examples/streaming.ts)** - 간단한 스트리밍 예제
- **[streaming-advanced.ts](./examples/streaming-advanced.ts)** - 이벤트 핸들러를 사용한 고급 스트리밍
- **[custom-model.ts](./examples/custom-model.ts)** - 커스텀 모델 설정
- **[workflow-basic.ts](./examples/workflow-basic.ts)** - 워크플로우 목록 및 실행

### 예제 실행하기

```bash
# 의존성 설치
npm install

# 예제 실행
npx tsx examples/basic.ts
npx tsx examples/streaming.ts
```

## 고급 사용법

### 커스텀 도구 호출 처리 (Tool Calls)

AI가 사용자가 등록한 도구 사용이 필요하다고 판단하면 `tool_call_required` 응답을 반환합니다. 이 경우 도구를 실행한 후 결과를 전달하여 대화를 이어갈 수 있습니다.

**중요**: 도구 결과와 함께 재요청할 때는:
- 이전 응답의 `checkpoint_id`를 포함해야 합니다
- 이전 요청과 **동일한** `request`를 사용해야 합니다

```typescript
// 1. 초기 요청
const response = await client.chat.completions.create({
  session_id: 'session_123',
  messages: [{ role: 'user', content: '오늘 날씨 알려줘' }],
  model: 'gpt-5.1',
  tools: [
    {
      type: 'built_in',
      id: 'all_tools'
    }
  ]
  stream: false,
});

if (response.type === 'tool_call_required') {
  // 2. 필요한 도구들을 실행
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const result = await executeYourTool(toolCall.name, toolCall.args);
      return {
        role: 'tool' as const,
        name: toolCall.name,
        tool_call_id: toolCall.tool_call_id,
        content: JSON.stringify(result),
      };
    })
  );

  // 3. 도구 결과와 함께 대화 이어가기
  const finalResponse = await client.chat.completions.create({
    session_id: 'session_123',
    messages: toolResults,
    checkpoint_id: response.configurable.checkpoint_id,
    model: 'gpt-5.1',  // 이전과 동일한 모델 설정
    tools: [
      {
        type: 'built_in',
        id: 'all_tools'
      }
    ]
  });
}
```

### 백그라운드 요약 (use_background_summarize)

대화 길이에 따른 컨텍스트 관리 옵션입니다.

#### `use_background_summarize: true` (롱텀 컨텍스트)

- ✅ **긴 대화 지원**: 대화가 길어져도 전체 맥락 유지
- ✅ **자동 요약**: 오래된 메시지를 백그라운드에서 자동 요약
- ✅ **메모리 효율**: 토큰 제한 없이 계속 대화 가능

**사용 케이스:**
- 장기간 상담/컨설팅 챗봇
- 복잡한 프로젝트 논의
- 여러 주제를 오가는 대화

```typescript
const response = await client.chat.completions.create({
  session_id: sessionId,
  messages: [{ role: 'user', content: '지난번 논의한 프로젝트 진행 상황은?' }],
  model: 'gpt-5.1',
  use_background_summarize: true,  // 롱텀 컨텍스트 유지
});
```

#### `use_background_summarize: false` (숏텀 컨텍스트)

**장점:**
- ⚡ **빠른 응답**: 최근 메시지만 처리하여 응답 속도 향상
- 💰 **비용 절감**: 적은 토큰 사용

**단점:**
- ❌ 오래된 대화 내용을 잊을 수 있음
- ❌ 긴 대화에서 맥락 손실 가능

**사용 케이스:**
- 간단한 Q&A 챗봇
- 단발성 문의 응답
- 실시간 고속 응답이 중요한 경우

```typescript
const response = await client.chat.completions.create({
  session_id: sessionId,
  messages: [{ role: 'user', content: '오늘 날씨는?' }],
  model: 'gpt-5.1'},
  use_background_summarize: false,  // 숏텀, 빠른 응답
});
```

### JSON 스키마를 사용한 구조화된 출력

```typescript
const response = await client.chat.completions.create({
  session_id: 'session_123',
  messages: [
    { role: 'user', content: '사용자 정보를 JSON으로 추출해줘: John Doe, 30세, 서울' }
  ],
  model: 'gpt-5.1',
  output_type: 'JSON',
  output_schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      city: { type: 'string' },
    },
    required: ['name', 'age', 'city'],
  },
});

if (response.type === 'final_response') {
  console.log('파싱된 JSON:', response.parsed);
  // 출력: { name: 'John Doe', age: 30, city: '서울' }
}
```

### 커스텀 속성 사용

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-5.1',
  properties: {
    // 모델별 추가 속성 (temperature, max_tokens 등)
    temperature: 0.7,
    maxTokens: 1000,
  },
  // ...
});
```

## 오류 처리

```typescript
import { TimelyGPTClient, APIError } from '@timely/gpt-sdk';

try {
  const response = await client.chat.completions.create({
    // ...params
  });
} catch (error) {
  if (error instanceof APIError) {
    console.error('API 오류:', error.message);
    console.error('상태 코드:', error.statusCode);
    console.error('오류 타입:', error.error);
  } else {
    console.error('예상치 못한 오류:', error);
  }
}
```

## 개발

### 빌드

```bash
npm run build
```

다음을 수행합니다:
1. `generate-models` 실행하여 최신 모델 타입 가져오기
2. `tsup`으로 SDK 빌드 (ESM + CJS)

### 개발 모드

```bash
npm run dev
```
### 모델 타입 생성

```bash
npm run generate-models
```


## 환경 변수

```bash
# 모델 타입 생성용
export TIMELY_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat

# 런타임용
export TIMELY_API_KEY=sdk_live_your_api_key_here
```

코드에서 사용:

```typescript
const client = new TimelyGPTClient({
  apiKey: process.env.TIMELY_API_KEY!,
  baseURL: process.env.TIMELY_BASE_URL,
});
```

## 인증 플로우

1. SDK가 API 키를 사용하여 JWT 액세스 토큰 요청(1일 유지)
2. 모든 API 호출은 `Authorization` 헤더에 액세스 토큰 사용

## 라이선스

MIT

## 지원

문제 및 질문:
- 🐛 **GitHub Issues**: [https://github.com/timely-hub/timely-gpt-sdk/issues](https://github.com/timely-hub/timely-gpt-sdk/issues)
- 📚 **REST API 문서**: [https://hello.timelygpt.co.kr/api/v2/chat/sdk](https://hello.timelygpt.co.kr/api/v2/chat/sdk)
- 📖 **개발 문서**: [SDK_API_SPEC.md](./SDK_API_SPEC.md)

---

Made with ❤️ by the Timely Team
