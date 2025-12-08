export const workflowData = {
  success: true,
  status: 200,
  data: {
    id: "01KBYTFNCSB108513ZTSC84FNX",
    workflow_id: "01KBQ01TPRCPC6YVEMMXE35PY4",
    user_id: "14",
    space_id: "bfbc49b7-f854-4b80-a698-849c1883c6fb",
    version: 3,
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
            x: 280,
            y: 90,
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
      ],
      edges: [
        {
          source: "1",
          target: "01KBXP6J2MTBC64Y60MKM9504J",
          type: "custom",
          animated: true,
          id: "xy-edge__1-01KBXP6J2MTBC64Y60MKM9504J",
        },
        {
          source: "01KBXP6J2MTBC64Y60MKM9504J",
          target: "01KBXP7DVPDZH9RD4QQHSEK8BK",
          type: "custom",
          animated: true,
          id: "xy-edge__01KBXP6J2MTBC64Y60MKM9504J-01KBXP7DVPDZH9RD4QQHSEK8BK",
        },
      ],
      viewport: {
        x: 193,
        y: 120,
        zoom: 1,
      },
    },
    archived_at: null,
    published_at: "2025-12-08T11:10:33.005Z",
    created_at: "2025-12-08T11:10:26.203Z",
    updated_at: "2025-12-08T11:10:33.006Z",
  },
};
