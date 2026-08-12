# OpenAI Compatible 사용 가이드

OpenAI 호환모드는 [OpenRouter](https://openrouter.ai/)에서 제공하는 다양한 모델을 Timely GPT의 크레딧으로 사용할 수 있습니다.
기존 [OpenAI SDK](https://platform.openai.com/docs/api-reference/introduction) 코드를 그대로 사용하면서 baseURL만 변경하여 다양한 AI 모델을 이용할 수 있습니다.

## 목차

- [설치](#설치)
- [기본 설정](#기본-설정)
  - [사용 가능한 호스트](#사용-가능한-호스트)
  - [연결 확인](#연결-확인)
  - [인증 오류 메시지로 원인 구분하기](#인증-오류-메시지로-원인-구분하기)
- [사용 가능한 모델](#사용-가능한-모델)
  - [종료된 모델 주의](#종료된-모델-주의)
- [채팅 완료 (Chat Completions)](#채팅-완료-chat-completions)
- [이미지 생성 (Image Generation)](#이미지-생성-image-generation)
- [에러 핸들링](#에러-핸들링)
- [Rate Limit](#rate-limit)
- [비용 및 크레딧](#비용-및-크레딧)
- [코딩 에이전트 연동 (OpenCode)](#코딩-에이전트-연동-opencode)
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

> ⚠️ **`baseURL` 을 바꾸지 않으면 키가 OpenAI 공식 서버로 전송되어 거절됩니다.**
> `Incorrect API key provided: tgpt_sk_...` 라는 에러가 뜨면 이 설정이 빠진 것입니다.
> 발급받은 `tgpt_sk_` 키는 아래 호스트에서만 유효합니다.

### 사용 가능한 호스트

| 호스트 | 사용 |
| --- | --- |
| `https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai` | ✅ |
| `https://hello.timelyai.io/api/v2/chat/bridge/openai` | ✅ (동일 응답) |
| 스페이스 접속 주소 (`ai.example.ac.kr` 등) | ❌ API 경로가 열려 있지 않음 |
| 그 외 도메인 | ❌ |

**스페이스에 평소 접속하는 주소로는 API 를 호출할 수 없습니다.** 그 주소에는 웹 화면만
연결되어 있습니다. 두 호스트 모두 공개 인터넷이므로 교내망·VPN 없이 외부에서 바로 됩니다.

### 연결 확인

설정을 바꾼 뒤 아래 명령으로 먼저 확인하면 원인을 빠르게 좁힐 수 있습니다.

```bash
curl https://hello.timelygpt.co.kr/api/v2/chat/bridge/info/models
```

JSON 목록이 나오면 정상입니다. HTML 이 돌아오면 주소가 잘못된 것입니다 —
**이 경우 상태코드가 200 이어도 실패**이므로 응답 본문까지 확인해야 합니다.

### 인증 오류 메시지로 원인 구분하기

인증에 실패했을 때, **어느 서버가 거절했는지가 메시지에 그대로 드러납니다.**
요청이 Timely 까지 왔는지부터 가리면 원인이 절반으로 좁혀집니다.

| 오류 메시지 | 거절한 곳 | 원인 |
| --- | --- | --- |
| `Incorrect API key provided: tgpt_sk_...`<br>(`platform.openai.com` 안내가 따라붙음) | OpenAI | **baseURL 이 적용되지 않음.** 키는 정상일 가능성이 높다 |
| `유효하지 않은 API 키입니다` (한글) | Timely | baseURL 은 정상. 키가 틀렸거나 이미 무효 — **재발급하면 기존 키는 비활성화**되므로 옛 키가 남아 있는지 확인 |
| `Missing Authorization header`<br>`Invalid Authorization header format` | Timely | baseURL 은 정상. 키가 요청에 실리지 않음(설정의 `apiKey` 항목 확인) |

가장 흔한 것은 첫 번째 줄입니다. `platform.openai.com` 이라는 문구가 보이면
키 문제가 아니라 **주소 문제**이므로, [사용 가능한 호스트](#사용-가능한-호스트)를 다시 확인하세요.

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

허용 모델은 수시로 바뀌므로 **실시간 목록을 API 로 확인**하는 것을 권장합니다. 인증 없이 조회할 수 있습니다.

```bash
curl https://hello.timelygpt.co.kr/api/v2/chat/bridge/info/models
```

아래는 2026-08-11 기준 목록입니다.

```typescript
[
  "openai/gpt-5.5",
  "openai/gpt-5.3-codex",
  "openai/gpt-5.1-codex-mini",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
  "openai/gpt-5-image-mini",
  "anthropic/claude-opus-4.7",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash-image",
  "x-ai/grok-4.3",
];
// 일부 모델은 `openai/gpt-5.5:batch` 처럼 `:batch` 접미사 변형도 허용됩니다.
// cursor 에디터에는 openai 모델이 사용 불가. (openrouter 공급자 버그)
```

> 목록에 없는 모델명을 쓰면 404 가 반환됩니다.
> 모델명은 위와 같이 `공급사/모델` 형식이어야 합니다.

### 종료된 모델 주의

OpenAI 가 **2026-08-10 자로 `gpt-5.2-chat-latest` · `gpt-5.3-chat-latest` 스냅샷을 API 에서 제거**했습니다
(2026-05-08 사전 공지, 공식 대체 모델 `gpt-5.6-sol`). 이 이름들은 이제 어디서도 동작하지 않습니다.

종료된 이름이 들어오면 Timely 가 대체 모델로 자동 치환하지만, **치환 결과가 이 브리지의 허용 목록에
들어 있다는 보장은 없습니다** — `gpt-5.6-sol` 이 현재 그렇습니다. 자동 치환에 기대지 말고 위 목록에서
직접 고르세요.

이름이 비슷한 `openai/gpt-5.3-codex` 는 **종료 대상이 아닌 별개 모델**이며 정상 사용 가능합니다.

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

## 코딩 에이전트 연동 (OpenCode)

OpenCode 처럼 OpenAI 호환 공급자를 직접 등록할 수 있는 도구는 설정 파일 하나로 연결됩니다.
**내장 "OpenAI" 공급자에 키만 넣으면 안 됩니다** — 그러면 요청이 OpenAI 공식 서버로 갑니다.
아래처럼 별도 공급자를 추가하세요.

`opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "timely": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Timely AI",
      "options": {
        "baseURL": "https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai",
        "apiKey": "{env:TIMELYGPT_API_KEY}"
      },
      "models": {
        "openai/gpt-5.5": { "name": "GPT-5.5 (Timely)" },
        "openai/gpt-5.3-codex": { "name": "GPT-5.3 Codex (Timely)" },
        "anthropic/claude-sonnet-4.6": { "name": "Claude Sonnet 4.6 (Timely)" }
      }
    }
  },
  "model": "timely/openai/gpt-5.5"
}
```

체크 포인트:

- `baseURL` 뒤에 `/v1` 을 붙이지 않습니다.
- 모델 ID 는 `공급사/모델` 형식 그대로 씁니다. `model` 값은 `공급자ID/모델ID` 라
  슬래시가 두 번 들어갑니다(`timely/openai/gpt-5.5`) — 첫 슬래시에서만 갈리므로 정상입니다.
- OpenAI 공식 모델명은 쓸 수 없습니다. 특히 에디터가 기본값으로 잡아두는
  `gpt-5.3-chat-latest` 는 [2026-08-10 자로 OpenAI 에서 종료](#종료된-모델-주의)돼 이중으로 실패합니다.
  [사용 가능한 모델](#사용-가능한-모델) 목록에서 고르세요.

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
    baseURL: "https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai",
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
