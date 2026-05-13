#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";

interface ModelResponse {
  success: boolean;
  status: number;
  data: Array<{
    value: string;
    label: string;
  }>;
}

async function fetchModels(baseURL: string): Promise<string[]> {
  const url = `${baseURL}/metadata/models`;

  console.log(`Fetching models from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch models: ${response.status} ${response.statusText}`
    );
  }

  const data: ModelResponse = await response.json();

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error("Invalid response format");
  }

  return data.data.map((model) => model.value);
}

function generateTypeDefinition(models: string[]): string {
  // JSON.stringify로 감싸 인용부호/이스케이프를 안전하게 처리한다.
  // 그대로 보간하면 모델명에 따옴표가 섞일 때 생성 파일에 코드가 주입될 수 있다.
  const modelUnion = models
    .map((model) => `  | ${JSON.stringify(model)}`)
    .join("\n");

  return `// This file is auto-generated. Do not edit manually.

/**
 * Available model types from Timely GPT API
 *
 * To regenerate this file, run:
 * npm run generate-models
 */
export type ModelType =
${modelUnion};

/**
 * List of all available models
 */
export const AVAILABLE_MODELS: readonly ModelType[] = [
${models.map((model) => `  ${JSON.stringify(model)},`).join("\n")}
] as const;
`;
}

async function main() {
  const baseURL =
    process.env.TIMELY_BASE_URL || "https://hello.timelygpt.co.kr/api/v2/chat";

  try {
    console.log("🔄 Fetching available models...");
    const models = await fetchModels(baseURL);

    console.log(`✅ Found ${models.length} models`);
    models.forEach((model) => console.log(`   - ${model}`));

    const typeDefinition = generateTypeDefinition(models);

    const outputPath = path.join(__dirname, "../src/generated/models.ts");
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, typeDefinition, "utf-8");

    console.log(`\n✅ Model types generated successfully!`);
    console.log(`📁 Output: ${outputPath}`);
  } catch (error) {
    console.error("❌ Error generating model types:", error);
    process.exit(1);
  }
}

main();
