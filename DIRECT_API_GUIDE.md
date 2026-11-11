# Timely API 사용 가이드 (OpenAI · Claude · Solar · Gemini)

Timely API 는 발급받은 연동 키(`tgpt_sk_...`) 하나로 OpenAI, Claude, Upstage Solar, Google Gemini 모델을 **각 공급사의 공식 API 형식 그대로** 호출하는 방식입니다.
공식 SDK 코드에서 `baseURL` 과 API 키만 바꾸면 되고, 사용량은 Timely AI 크레딧으로 차감됩니다.

| 모델 | 호출 형식 | 사용하는 SDK |
| --- | --- | --- |
| OpenAI (GPT) | OpenAI API (`chat/completions`, `responses`) | [OpenAI SDK](https://platform.openai.com/docs/api-reference/introduction) |
| Claude | Anthropic Messages API (`/v1/messages`) | [Anthropic SDK](https://docs.anthropic.com/en/api/messages) |
| Solar (Upstage) | Upstage API (`chat/completions`, OpenAI 호환) | [OpenAI SDK](https://console.upstage.ai/docs/capabilities/chat) |
| Gemini (Google) | Gemini API (`generateContent`) | [Google Gen AI SDK](https://ai.google.dev/gemini-api/docs) |

> 기존 [OpenAI 호환 모드](./OPENAI_SDK_GUIDE.md)(`.../bridge/openai`)는 종료될 예정이며, 주소와 모델명이 다릅니다.
> 차이는 [기존 OpenAI 호환 모드와의 차이](#기존-openai-호환-모드와의-차이)를 참고하세요.

## 목차

- [기본 주소](#기본-주소)
- [인증](#인증)
- [OpenAI 모델 사용](#openai-모델-사용)
- [Claude 모델 사용](#claude-모델-사용)
- [Solar 모델 사용](#solar-모델-사용)
- [Gemini 모델 사용](#gemini-모델-사용)
- [사용 가능한 모델](#사용-가능한-모델)
- [지원 범위](#지원-범위)
- [에러 코드](#에러-코드)
- [Rate Limit](#rate-limit)
- [비용 및 크레딧](#비용-및-크레딧)
- [코딩 에이전트 연동](#코딩-에이전트-연동)
- [기존 OpenAI 호환 모드와의 차이](#기존-openai-호환-모드와의-차이)

## 기본 주소

| 용도 | baseURL |
| --- | --- |
| OpenAI SDK | `https://hello.timelyai.io/api/v2/chat/direct/openai/v1` |
| Anthropic SDK | `https://hello.timelyai.io/api/v2/chat/direct/anthropic` |
| OpenAI SDK (Solar) | `https://hello.timelyai.io/api/v2/chat/direct/upstage/v1` |
| Google Gen AI SDK | `https://hello.timelyai.io/api/v2/chat/direct/google` |

- 기존 `hello.timelygpt.co.kr` 호스트도 동일하게 동작합니다.
- 스페이스에 평소 접속하는 주소(`ai.example.ac.kr` 등)로는 API 를 호출할 수 없습니다. 그 주소에는 웹 화면만 연결되어 있습니다.
- Anthropic SDK 는 baseURL 뒤에 `/v1/messages` 를 스스로 붙이므로, baseURL 에 `/v1` 을 넣지 않습니다.
- Google Gen AI SDK 도 baseURL 뒤에 `/v1beta/models/...` 를 스스로 붙이므로, baseURL 에 버전을 넣지 않습니다.

## 인증

연동 키를 각 SDK 의 API 키 자리에 그대로 넣습니다. 아래 헤더를 모두 받습니다.

| 헤더 | 사용하는 곳 |
| --- | --- |
| `Authorization: Bearer tgpt_sk_...` | OpenAI SDK, Anthropic SDK 의 `authToken` |
| `x-api-key: tgpt_sk_...` | Anthropic SDK 의 `apiKey` |
| `x-goog-api-key: tgpt_sk_...` | Google Gen AI SDK 의 `apiKey` |

> ⚠️ **`baseURL` 을 바꾸지 않으면 키가 공급사 공식 서버로 전송되어 거절됩니다.**
> `Incorrect API key provided: tgpt_sk_...` 또는 `invalid x-api-key` 오류가 보이면 키가 아니라 주소 설정이 빠진 것입니다.

## OpenAI 모델 사용

### 설치와 설정

```bash
npm install openai
```

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://hello.timelyai.io/api/v2/chat/direct/openai/v1",
  apiKey: process.env.TIMELYGPT_API_KEY,
});
```

### Chat Completions

```typescript
const completion = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "안녕하세요!" }],
});

console.log(completion.choices[0].message.content);
```

### 스트리밍

```typescript
const stream = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "긴 이야기를 들려주세요." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

스트리밍 응답의 마지막에는 `choices` 가 빈 배열이고 `usage` 가 담긴 조각이 항상 한 번 옵니다
(`stream_options.include_usage` 를 지정하지 않아도 서버가 켭니다). 위 예시처럼 `chunk.choices[0]?.` 로 접근하면 됩니다.

### Responses API

```typescript
const response = await client.responses.create({
  model: "gpt-5.5",
  input: "서울의 봄 날씨를 한 문장으로 알려 주세요.",
});

console.log(response.output_text);
```

### 함수 호출(Function calling)

OpenAI 공식 문서의 방식 그대로 사용할 수 있습니다.

```typescript
const completion = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "서울 날씨 알려 줘" }],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "도시의 현재 날씨를 조회합니다",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    },
  ],
});
```

### LangChain

```typescript
import { ChatOpenAI } from "@langchain/openai";

const chat = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.TIMELYGPT_API_KEY,
  configuration: {
    baseURL: "https://hello.timelyai.io/api/v2/chat/direct/openai/v1",
  },
});
```

## Claude 모델 사용

### 설치와 설정

```bash
npm install @anthropic-ai/sdk
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "https://hello.timelyai.io/api/v2/chat/direct/anthropic",
  apiKey: process.env.TIMELYGPT_API_KEY,
});
```

### Messages

```typescript
const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "안녕하세요!" }],
});

console.log(message.content);
```

### 스트리밍

```typescript
const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "긴 이야기를 들려주세요." }],
});

stream.on("text", (text) => process.stdout.write(text));
const finalMessage = await stream.finalMessage();
```

### Python

```python
import os
from anthropic import Anthropic

client = Anthropic(
    base_url="https://hello.timelyai.io/api/v2/chat/direct/anthropic",
    api_key=os.environ["TIMELYGPT_API_KEY"],
)

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "안녕하세요!"}],
)
```

도구 사용(tool use), 시스템 프롬프트, 이미지 입력, 확장 사고(thinking), 프롬프트 캐싱(`cache_control`)은 Anthropic 공식 문서의 방식 그대로 사용할 수 있습니다.

응답의 `model` 값은 요청에 보낸 모델명과 같습니다.

## Solar 모델 사용

Upstage Solar 는 OpenAI Chat Completions 호환 API 입니다. OpenAI SDK 에 Solar 용 `baseURL` 을 지정해 사용합니다.

```typescript
import OpenAI from "openai";

const solar = new OpenAI({
  baseURL: "https://hello.timelyai.io/api/v2/chat/direct/upstage/v1",
  apiKey: process.env.TIMELYGPT_API_KEY,
});

const completion = await solar.chat.completions.create({
  model: "solar-pro4",
  messages: [{ role: "user", content: "안녕하세요!" }],
});

console.log(completion.choices[0].message.content);
```

스트리밍과 함수 호출은 [OpenAI 모델 사용](#openai-모델-사용)의 Chat Completions 예시와 같은 방식으로 사용합니다.
OpenAI 모델과 Solar 모델은 `baseURL` 이 다르므로 클라이언트를 따로 만들어야 합니다.

## Gemini 모델 사용

Gemini 는 Google 의 Gemini API(`generateContent`) 형식으로 호출합니다. Google Gen AI SDK 에 `baseUrl` 과 API 키만 지정합니다.

### 설치와 설정

```bash
npm install @google/genai
```

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.TIMELYGPT_API_KEY,
  httpOptions: { baseUrl: "https://hello.timelyai.io/api/v2/chat/direct/google" },
});
```

### generateContent

```typescript
const response = await ai.models.generateContent({
  model: "gemini-3.5-flash",
  contents: "안녕하세요!",
});

console.log(response.text);
```

### 스트리밍

```typescript
const stream = await ai.models.generateContentStream({
  model: "gemini-3.5-flash",
  contents: "긴 이야기를 들려주세요.",
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text ?? "");
}
```

토큰 사용량(`usageMetadata`)은 스트림의 마지막 조각에 담겨 옵니다.

### Python

```python
import os
from google import genai
from google.genai import types

client = genai.Client(
    api_key=os.environ["TIMELYGPT_API_KEY"],
    http_options=types.HttpOptions(
        base_url="https://hello.timelyai.io/api/v2/chat/direct/google"
    ),
)

response = client.models.generate_content(
    model="gemini-3.5-flash",
    contents="안녕하세요!",
)
print(response.text)
```

### REST 로 직접 호출

```bash
curl "https://hello.timelyai.io/api/v2/chat/direct/google/v1beta/models/gemini-3.5-flash:generateContent" \
  -H "x-goog-api-key: $TIMELYGPT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"안녕하세요!"}]}]}'
```

스트리밍은 `:streamGenerateContent?alt=sse` 로 호출합니다. `alt=sse` 가 없는 스트리밍 요청은 지원하지 않습니다.

시스템 지시문(`systemInstruction`), 함수 호출(`functionDeclarations`), 구조화 출력(`responseSchema`), 이미지 입력(`inlineData`), 사고 설정(`thinkingConfig`)은 Google 공식 문서의 방식 그대로 사용할 수 있습니다.

## 사용 가능한 모델

모델 목록은 각 공급사와 Timely AI 모델 카탈로그를 따르며, 변동될 수 있습니다.
아래는 2026년 11월 11일 기준 목록입니다. 모델명은 **공급사 공식 이름**을 그대로 쓰고, `openai/`·`anthropic/`·`upstage/`·`google/` 같은 접두를 붙이지 않습니다.

| 공급사 | 모델 |
| --- | --- |
| OpenAI (24종) | `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.3-codex`, `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`, `o3` |
| Claude (14종) | `claude-fable-5-2`, `claude-fable-5-1`, `claude-fable-5`, `claude-opus-5-5`, `claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-5-5`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-sonnet-4-5`, `claude-haiku-5-5`, `claude-haiku-4-5` |
| Solar (2종) | `solar-pro4`, `solar-mini4` |
| Gemini (10종) | `gemini-4-argon`, `gemini-4-carbon`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview` |

- `gpt-5.5-pro` 와 `gpt-5.3-codex` 는 Responses API(`/responses`)로만 호출할 수 있습니다. Chat Completions 로 호출하면 404 가 반환됩니다.
- 각 주소에서는 그 공급사의 모델만 호출할 수 있습니다(예: OpenAI 주소에서 Solar 모델은 404).
- Grok 등 그 밖의 공급사 모델은 Timely API 에서 제공하지 않습니다.

지금 내 키로 호출할 수 있는 모델은 **API 로 실시간 목록을 확인**할 수 있습니다. 목록에는 내 스페이스·그룹에서 사용할 수 있는 모델만 나옵니다.

```bash
# OpenAI 모델
curl https://hello.timelyai.io/api/v2/chat/direct/openai/v1/models \
  -H "Authorization: Bearer $TIMELYGPT_API_KEY"

# Claude 모델
curl https://hello.timelyai.io/api/v2/chat/direct/anthropic/v1/models \
  -H "x-api-key: $TIMELYGPT_API_KEY"

# Solar 모델
curl https://hello.timelyai.io/api/v2/chat/direct/upstage/v1/models \
  -H "Authorization: Bearer $TIMELYGPT_API_KEY"

# Gemini 모델
curl https://hello.timelyai.io/api/v2/chat/direct/google/v1beta/models \
  -H "x-goog-api-key: $TIMELYGPT_API_KEY"
```

## 지원 범위

### OpenAI

| 경로 | 지원 |
| --- | --- |
| `POST /chat/completions` | ✅ (스트리밍 포함) |
| `POST /responses` | ✅ (스트리밍 포함) |
| `GET /models`, `GET /models/{id}` | ✅ |
| 임베딩, 이미지, 오디오, 파일, 배치, Assistants 등 | ❌ (404) |

다음 기능은 요청 시 400 으로 거절됩니다.

- Responses API 의 내장 도구: `web_search`, `file_search`, `code_interpreter`, `image_generation`, `computer_use`, 원격 `mcp` 등 (`function`·`custom` 도구만 사용 가능)
- Responses API 의 `background: true`
- Chat Completions 의 `web_search_options`
- `service_tier` 의 `priority`·`flex`

### Claude

| 경로 | 지원 |
| --- | --- |
| `POST /v1/messages` | ✅ (스트리밍 포함) |
| `GET /v1/models` | ✅ |
| `POST /v1/messages/count_tokens`, 배치, 파일 등 | ❌ (404) |

다음 기능은 요청 시 400 으로 거절됩니다.

- 서버 도구: `web_search`, `web_fetch`, `code_execution`
- `mcp_servers`

직접 정의한 도구와 클라이언트에서 실행하는 도구(`bash`, `text_editor`, `computer`)는 사용할 수 있습니다.

### Solar

| 경로 | 지원 |
| --- | --- |
| `POST /chat/completions` | ✅ (스트리밍 포함) |
| `GET /models`, `GET /models/{id}` | ✅ |
| 임베딩, 문서 파싱 등 그 밖의 Upstage API | ❌ (404) |

### Gemini

| 경로 | 지원 |
| --- | --- |
| `POST /v1beta/models/{model}:generateContent` | ✅ |
| `POST /v1beta/models/{model}:streamGenerateContent?alt=sse` | ✅ |
| `GET /v1beta/models`, `GET /v1beta/models/{model}` | ✅ |
| `countTokens`, `embedContent`, `cachedContents`, 파일, 배치, Live API 등 | ❌ (404) |

다음 기능은 요청 시 400 으로 거절됩니다.

- 내장 도구: `googleSearch`, `codeExecution`, `urlContext` 등 (`functionDeclarations` 만 사용 가능)
- `cachedContent`(명시적 캐시). 자동 캐시는 그대로 적용됩니다
- `fileData`(파일 주소 참조). 파일은 `inlineData` 로 보냅니다
- 오디오·영상 입력
- 글 이외의 출력(`responseModalities` 에 `IMAGE`·`AUDIO`), `candidateCount` 2 이상

## 에러 코드

오류 응답은 각 공급사의 형식을 따릅니다.

```jsonc
// OpenAI · Solar 경로
{ "error": { "message": "...", "type": "insufficient_quota", "param": null, "code": "insufficient_quota" } }

// Claude 경로
{ "type": "error", "error": { "type": "billing_error", "message": "..." } }

// Gemini 경로
{ "error": { "code": 402, "message": "...", "status": "RESOURCE_EXHAUSTED" } }
```

| 상태 코드 | 의미 | 해결 방법 |
| --- | --- | --- |
| 400 | 잘못된 요청 또는 지원하지 않는 기능 | 요청 파라미터와 [지원 범위](#지원-범위)를 확인하세요 |
| 401 | 인증 실패 | API 키와 `baseURL` 을 확인하세요. 키를 재발급하면 이전 키는 비활성화됩니다 |
| 402 | 크레딧 부족 또는 한도 초과 | 메시지에 어느 한도(스페이스 크레딧·멤버 제한량·그룹 월별 총량·부서·개인 한도)인지 표시됩니다. 관리자에게 문의하세요 |
| 403 | 사용이 제한된 모델 | 스페이스 또는 소속 그룹에서 꺼 둔 모델입니다. 관리자에게 문의하세요 |
| 404 | 제공하지 않는 모델 또는 경로 | [사용 가능한 모델](#사용-가능한-모델) 목록의 이름을 사용하세요 |
| 429 | Rate Limit 초과 | 잠시 후 다시 시도하세요 |
| 502 | 모델 공급사 연결 실패 | 잠시 후 다시 시도하고, 계속되면 관리자에게 문의하세요 |
| 503 | 크레딧 확인 일시 실패 | 잠시 후 다시 시도하세요 |

402 는 다시 시도해도 해결되지 않으므로 자동 재시도 대상에서 제외하는 것을 권장합니다.

## Rate Limit

Rate Limit 은 **크레딧 잔액에 따라 동적으로 조정**되며, OpenAI·Claude·Solar·Gemini 경로와 기존 OpenAI 호환 모드가 **같은 한도를 함께 사용**합니다.

| 상태 | 크레딧 잔액 | 분당 요청 수 | 동시 실행 수 |
| --- | --- | --- | --- |
| 정상 | 50,000 이상 | 60 | 제한 없음 |
| 경고 | 50,000 미만 | 30 | 3 |
| 주의 | 10,000 미만 | 20 | 2 |
| 심각 | 5,000 미만 | 10 | 1 |
| 차단 | 2 미만 | 사용 불가 (402) | - |

크레딧 잔액은 스페이스 크레딧과 멤버 제한량 중 더 적은 쪽을 기준으로 합니다.

## 비용 및 크레딧

- 모든 호출은 Timely AI 크레딧으로 차감되며, 사용 내역에는 「API 채팅」으로 기록됩니다.
- 비용은 **사용한 토큰 수 × 모델별 단가**로 계산됩니다. 입력·출력 토큰과 캐시 읽기·쓰기 토큰이 각각의 단가로 반영됩니다.
- Gemini 의 사고(thinking) 토큰은 출력 토큰으로 차감됩니다.
- 스트리밍 도중 연결을 끊어도 생성은 끝까지 진행되며, 전체 사용량이 차감됩니다.
- 남은 크레딧이 적으면 응답 길이가 남은 크레딧으로 생성할 수 있는 분량으로 제한됩니다. 이때 응답은 `finish_reason: "length"`(Claude 는 `stop_reason: "max_tokens"`, Gemini 는 `finishReason: "MAX_TOKENS"`)로 끝납니다. 생성할 수 있는 분량이 너무 적으면 호출 전에 402 가 반환됩니다.
- 응답 본문의 `usage` 는 공급사가 보낸 값 그대로입니다.

## 코딩 에이전트 연동

### OpenCode

`opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "timely": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Timely AI",
      "options": {
        "baseURL": "https://hello.timelyai.io/api/v2/chat/direct/openai/v1",
        "apiKey": "{env:TIMELYGPT_API_KEY}"
      },
      "models": {
        "gpt-5.5": { "name": "GPT-5.5 (Timely)" },
        "gpt-5.3-codex": { "name": "GPT-5.3 Codex (Timely)" }
      }
    }
  },
  "model": "timely/gpt-5.5"
}
```

내장 「OpenAI」 공급자에 키만 넣으면 요청이 OpenAI 공식 서버로 전송됩니다. 위와 같이 별도 공급자를 추가해야 합니다.

## 기존 OpenAI 호환 모드와의 차이

| 항목 | 기존 OpenAI 호환 모드 | Timely API |
| --- | --- | --- |
| 주소 | `.../api/v2/chat/bridge/openai` | `.../api/v2/chat/direct/openai/v1`, `.../api/v2/chat/direct/anthropic`, `.../api/v2/chat/direct/upstage/v1`, `.../api/v2/chat/direct/google` |
| 모델명 | `openai/gpt-5.5`, `anthropic/claude-sonnet-4.6`, `upstage/solar-pro4`, `google/gemini-3.5-flash` | `gpt-5.5`, `claude-sonnet-4-6`, `solar-pro4`, `gemini-3.5-flash` |
| Claude 호출 형식 | OpenAI Chat Completions 형식 | Anthropic Messages 형식 |
| Gemini 호출 형식 | OpenAI Chat Completions 형식 | Gemini API(`generateContent`) 형식 |
| 제공 모델 | OpenAI, Claude, Gemini, Grok, Solar 등 | OpenAI, Claude, Solar, Gemini |
| 모델 목록 조회 | 인증 없이 조회 | API 키 필요, 내가 쓸 수 있는 모델만 표시 |

기존 OpenAI 호환 모드에서 옮겨 올 때는 `baseURL` 을 공급사별 주소로 바꾸고, 모델명에서 `openai/`·`anthropic/`·`upstage/`·`google/` 접두를 뗀 공식 이름으로 바꿉니다.
Claude 는 OpenAI SDK 가 아니라 Anthropic SDK 로, Gemini 는 Google Gen AI SDK 로 호출해야 합니다.
