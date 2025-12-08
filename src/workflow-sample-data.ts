export const workflowData = {
  success: true,
  status: 200,
  data: {
    id: "01KBYX3K0NTPCKMJSDNDM3V9Z3",
    workflow_id: "01KBQ01TPRCPC6YVEMMXE35PY4",
    user_id: "14",
    space_id: "bfbc49b7-f854-4b80-a698-849c1883c6fb",
    version: 4,
    base_version: null,
    status: "PUBLISHED",
    is_production: true,
    name: "이미지 생성",
    description: null,
    workflow_data: {
      nodes: [
        {
          id: "1",
          type: "start",
          data: {
            label: "START",
            nodeData: {
              type: "form",
              schema: {
                type: "object",
                properties: {
                  startMessage: {
                    type: "string",
                  },
                },
                required: ["startMessage"],
                additionalProperties: false,
              },
            },
          },
          position: {
            x: 0,
            y: 50,
          },
          measured: {
            width: 200,
            height: 83,
          },
          selected: false,
        },
        {
          id: "01KBXP6J2MTBC64Y60MKM9504J",
          type: "tool",
          data: {
            label: "TOOL",
            inputBindings: {
              model: '"gemini-3-pro-image"',
              prompt: "START.startMessage",
              aspectRatio: '"portrait"',
            },
            nodeData: {
              tool: {
                id: "generate_image",
                name: "이미지 생성",
                schema: {
                  $schema: "https://json-schema.org/draft/2020-12/schema",
                  type: "object",
                  properties: {
                    prompt: {
                      description: "프롬프트",
                      type: "string",
                    },
                    model: {
                      type: "string",
                      enum: ["gemini-2.5-flash-image", "gemini-3-pro-image"],
                    },
                    aspectRatio: {
                      description: "aspect ratio",
                      type: "string",
                      enum: ["landscape", "portrait"],
                    },
                  },
                  required: ["prompt"],
                  additionalProperties: false,
                },
                description: "Create image tool",
                response_schema: {
                  $schema: "https://json-schema.org/draft/2020-12/schema",
                  type: "object",
                  properties: {
                    output: {
                      description: "생성된 이미지 URL",
                      type: "string",
                    },
                  },
                  required: ["output"],
                  additionalProperties: false,
                },
              },
              type: "built-in",
            },
          },
          position: {
            x: 390,
            y: 290,
          },
          measured: {
            width: 200,
            height: 91,
          },
          selected: false,
          dragging: false,
        },
        {
          id: "01KBXP7DVPDZH9RD4QQHSEK8BK",
          type: "end",
          data: {
            label: "END",
            inputBindings: {},
            nodeData: {
              output_type: "TEXT",
            },
          },
          position: {
            x: 590,
            y: 140,
          },
          measured: {
            width: 200,
            height: 71,
          },
          selected: false,
          dragging: false,
        },
        {
          id: "01KBYX3PH8YGJSJFKNKYVYCHRV",
          type: "tool",
          data: {
            label: "TOOL_2",
            inputBindings: {
              a: "4",
              b: "2",
            },
            nodeData: {
              tool: {
                id: "01KBYX3BBEMCJD0QMHH13BF1HF",
                user_id: "14",
                space_id: "bfbc49b7-f854-4b80-a698-849c1883c6fb",
                name: "add_numbers",
                description:
                  "두 개의 숫자를 입력받아 더한 결과를 반환하는 함수",
                schema: {
                  type: "object",
                  properties: {
                    a: {
                      type: "number",
                      description: "더할 첫 번째 숫자",
                    },
                    b: {
                      type: "number",
                      description: "더할 두 번째 숫자",
                    },
                  },
                  required: ["a", "b"],
                },
                function_body:
                  "\nconst { a, b } = params;\n\n// 입력값 검증\nif (typeof a !== 'number' || typeof b !== 'number') {\n  throw new Error('a와 b는 모두 숫자여야 합니다');\n}\n\n// 두 수를 더함\nconst result = a + b;\n\n// 결과 반환\nreturn {\n  a: a,\n  b: b,\n  sum: result\n};\n",
                created_at: "2025-12-08T11:56:08.430Z",
                updated_at: "2025-12-08T11:56:08.430Z",
                response_schema: {
                  type: "object",
                  properties: {
                    a: {
                      type: "number",
                      description: "입력받은 첫 번째 숫자",
                    },
                    b: {
                      type: "number",
                      description: "입력받은 두 번째 숫자",
                    },
                    sum: {
                      type: "number",
                      description: "두 숫자의 합 (a + b)",
                    },
                  },
                  required: ["a", "b", "sum"],
                },
              },
              type: "custom",
            },
          },
          position: {
            x: 130,
            y: 250,
          },
          measured: {
            width: 200,
            height: 91,
          },
          selected: true,
          dragging: false,
        },
      ],
      edges: [
        {
          source: "01KBXP6J2MTBC64Y60MKM9504J",
          target: "01KBXP7DVPDZH9RD4QQHSEK8BK",
          type: "custom",
          animated: true,
          id: "xy-edge__01KBXP6J2MTBC64Y60MKM9504J-01KBXP7DVPDZH9RD4QQHSEK8BK",
        },
        {
          source: "1",
          target: "01KBYX3PH8YGJSJFKNKYVYCHRV",
          type: "custom",
          animated: true,
          id: "xy-edge__1-01KBYX3PH8YGJSJFKNKYVYCHRV",
        },
        {
          source: "01KBYX3PH8YGJSJFKNKYVYCHRV",
          target: "01KBXP6J2MTBC64Y60MKM9504J",
          type: "custom",
          animated: true,
          id: "xy-edge__01KBYX3PH8YGJSJFKNKYVYCHRV-01KBXP6J2MTBC64Y60MKM9504J",
        },
      ],
      viewport: {
        x: 276,
        y: 248,
        zoom: 1,
      },
    },
    archived_at: null,
    published_at: "2025-12-08T11:57:57.142Z",
    created_at: "2025-12-08T11:56:16.278Z",
    updated_at: "2025-12-08T11:57:57.142Z",
  },
};
