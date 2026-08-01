/**
 * Lightweight JSON Schema subset used for tool input validation
 * and later Gemini / LLM functionDeclarations mapping.
 */
export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

export type JsonSchema = {
  type?: JsonSchemaType | JsonSchemaType[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
};

/** Optional runtime context passed into every tool handler. */
export type ToolContext = {
  userId?: string;
  conversationId?: string;
  tripId?: string;
  signal?: AbortSignal;
  /** Extensible bag for callers (chat route, API, tests). */
  meta?: Record<string, unknown>;
};

export type ToolSuccess<T = unknown> = {
  ok: true;
  data: T;
};

export type ToolFailure = {
  ok: false;
  error: string;
  code?:
    | "TOOL_NOT_FOUND"
    | "INVALID_INPUT"
    | "HANDLER_ERROR"
    | "NOT_IMPLEMENTED"
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | string;
  details?: unknown;
};

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolFailure;

export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  ctx: ToolContext,
) => Promise<ToolResult<TOutput>> | ToolResult<TOutput>;

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: ToolHandler<TInput, TOutput>;
};

/** LLM-facing summary (no handler). */
export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};
