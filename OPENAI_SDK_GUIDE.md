# OpenAI Compatible 사용 가이드

OpenAI 호환모드는 [OpenRouter](https://openrouter.ai/)에서 제공하는 다양한 모델을 Timely GPT의 크레딧으로 사용할 수 있습니다.
기존 [OpenAI SDK](https://platform.openai.com/docs/api-reference/introduction) 코드를 그대로 사용하면서 baseURL만 변경하여 다양한 AI 모델을 이용할 수 있습니다.

## 목차

- [설치](#설치)
- [기본 설정](#기본-설정)
- [사용 가능한 모델 확인](#사용-가능한-모델-확인)
- [채팅 완료 (Chat Completions)](#채팅-완료-chat-completions)
- [이미지 생성 (Image Generation)](#이미지-생성-image-generation)
- [에러 핸들링](#에러-핸들링)
- [Rate Limit](#rate-limit)
- [비용 및 크레딧](#비용-및-크레딧)
- [LangChain 사용](#langchain-사용)

## 설치

```bash
npm install openai
# 또는
pnpm add openai
# 또는
yarn add openai
```

## 기본 설정

OpenAI SDK 클라이언트를 생성할 때 `baseURL`과 `apiKey`만 변경하면 됩니다.

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai",
  apiKey: "your-timely-api-key", // Timely AI API 키
});
```

### 환경 변수 사용

```bash
# .env 파일
TIMELYGPT_API_KEY=your-timely-api-key
OPENAI_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai
```

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.TIMELYGPT_API_KEY,
});
```

## 사용 가능한 모델

```typescript
[
  "google/gemini-3-flash-preview",
  "x-ai/grok-4.1-fast",
  "openai/gpt-5.1-codex-mini",
  "openai/gpt-5-image-mini",
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash-image",
  "x-ai/grok-4-fast",
  "x-ai/grok-code-fast-1",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
];
```

## 채팅 완료 (Chat Completions)

### 기본 사용법 (Non-streaming)

```typescript
const completion = await client.chat.completions.create({
  model: "openai/gpt-4.1-mini",
  messages: [{ role: "user", content: "안녕하세요!" }],
});

console.log(completion.choices[0].message.content);
```

### 스트리밍 사용법

```typescript
const stream = await client.chat.completions.create({
  model: "openai/gpt-4.1-mini",
  messages: [{ role: "user", content: "긴 이야기를 들려주세요." }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
```

### 멀티모달 (이미지 입력)

```typescript
const completion = await client.chat.completions.create({
  model: "google/gemini-3-flash-preview",
  messages: [
    {
      role: "user" as const,
      content: [
        { type: "text", text: "이 이미지에 무엇이 있나요?" },
        {
          type: "image_url",
          image_url: { url: "http://example.png" },
        },
      ],
    },
  ],
});

console.log(completion.choices[0].message.content);
```

## 이미지 생성 (Image Generation)

### 나노바나나 모델로 이미지 생성

```typescript
const completion = await client.chat.completions.create({
  model: "google/gemini-2.5-flash-image",
  messages: [
    {
      role: "user",
      content:
        "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme",
    },
  ],
  // @ts-expect-error - modalities is not defined in the type but it is supported by the model
  modalities: ["image", "text"],
  image_config: {
    aspect_ratio: "16:9",
    image_size: "4K",
  },
});
console.log(JSON.stringify(completion, null, 2));
```

## 에러 핸들링

```typescript
try {
  const completion = await client.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
  });
  console.log(completion.choices[0].message.content);
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error("API 에러:", error.status, error.message);

    if (error.status === 401) {
      console.error("인증 실패: API 키를 확인하세요");
    } else if (error.status === 429) {
      console.error("Rate Limit 초과: 잠시 후 다시 시도하세요");
    } else if (error.status === 402) {
      console.error("크레딧 부족: 크레딧을 충전하세요");
    } else if (error.status === 500) {
      console.error("서버 에러: 관리자에게 문의하세요");
    }
  } else {
    console.error("알 수 없는 에러:", error);
  }
}
```

### 주요 에러 코드

| 상태 코드 | 설명                | 해결 방법                                                         |
| --------- | ------------------- | ----------------------------------------------------------------- |
| 401       | 인증 실패           | API 키를 확인하세요                                               |
| 402       | 크레딧 부족         | 크레딧을 충전하세요                                               |
| 429       | Rate Limit 초과     | 잠시 후 다시 시도하세요 (분당 요청 제한 또는 동시 실행 제한 초과) |
| 400       | 잘못된 요청         | 요청 파라미터를 확인하세요                                        |
| 404       | 모델을 찾을 수 없음 | 모델 이름을 확인하세요                                            |
| 500       | 서버 에러           | 관리자에게 문의하세요                                             |

## Rate Limit

현재 Rate Limit 정책은 **크레딧 잔액에 따라 동적으로 조정**됩니다:

### 분당 요청 제한 (Requests Per Minute)

- **정상**: 60 requests/minute (크레딧 충분)
- **경고**: 30 requests/minute (크레딧 50,000 미만)
- **주의**: 20 requests/minute (크레딧 10,000 미만)
- **심각**: 10 requests/minute (크레딧 5,000 미만)
- **차단**: 크레딧 2 미만 시 API 사용 불가

### 동시 실행 제한 (Concurrent Requests)

크레딧 잔액에 따라 동시에 실행 가능한 요청 수가 제한됩니다:

- **정상**: 제한 없음 (크레딧 충분)
- **경고**: 최대 3개 동시 실행 (크레딧 50,000 미만)
- **주의**: 최대 2개 동시 실행 (크레딧 10,000 미만)
- **심각**: 최대 1개만 실행 (크레딧 5,000 미만)

Rate Limit 초과 시 429 에러가 반환되며, 잠시 후 다시 시도할 수 있습니다.

## 비용 및 크레딧

### 크레딧 시스템

- 모든 API 호출은 TimelyGPT 크레딧으로 결제됩니다
- 비용은 사용한 토큰 또는 이미지 생성 횟수에 따라 자동 계산됩니다
- 크레딧이 부족하면 402 에러가 반환됩니다

## LangChain 사용

LangChain을 사용하는 경우에도 동일한 방식으로 `baseURL`만 변경하면 됩니다.

### 설치

```bash
npm install @langchain/openai @langchain/core
# 또는
pnpm add @langchain/openai @langchain/core
# 또는
yarn add @langchain/openai @langchain/core
```

### 기본 설정 및 사용법

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const chat = new ChatOpenAI({
  model: "openai/gpt-4.1-mini",
  apiKey: "your-timely-api-key",
  configuration: {
    baseURL: "http://localhost:8000/api-ai/v2/bridge/openai",
  },
});

const response = await chat.invoke([
  { role: "user", content: "Hello, how are you?" },
]);
console.log(response);
```

### 참고 사항

OpenRouter의 모델 문서에서 각 모델의 사용방법을 확인 할 수 있습니다.
_예시_:
[Gemini 3 Flash Preview 모델 소개 페이지](https://openrouter.ai/google/gemini-3-flash-preview/api)
에서 Quickstart -> 코드 탭의 `openai-typescript`
