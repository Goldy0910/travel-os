import type { JsonSchema, JsonSchemaType } from "@/lib/tools/types";

export type SchemaValidationSuccess<T = unknown> = {
  ok: true;
  data: T;
};

export type SchemaValidationFailure = {
  ok: false;
  error: string;
  path: string;
};

export type SchemaValidationResult<T = unknown> =
  | SchemaValidationSuccess<T>
  | SchemaValidationFailure;

function typeLabel(type: JsonSchemaType | JsonSchemaType[] | undefined): string {
  if (!type) return "any";
  return Array.isArray(type) ? type.join("|") : type;
}

function matchesType(value: unknown, type: JsonSchemaType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return false;
  }
}

function fail(path: string, error: string): SchemaValidationFailure {
  return { ok: false, error, path };
}

/**
 * Validate `value` against a JSON-Schema-compatible subset.
 * Returns a shallow-cloned object/array with defaults applied where defined.
 */
export function validateAgainstSchema<T = unknown>(
  schema: JsonSchema,
  value: unknown,
  path = "",
): SchemaValidationResult<T> {
  const at = path || "$";

  if (value === undefined) {
    if ("default" in schema) {
      return validateAgainstSchema(schema, schema.default, path);
    }
    return fail(at, `Missing value at ${at}`);
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      return fail(at, `Expected ${typeLabel(schema.type)} at ${at}`);
    }
  }

  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) {
    return fail(at, `Value at ${at} must be one of: ${schema.enum.map(String).join(", ")}`);
  }

  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) {
      return fail(at, `String at ${at} shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      return fail(at, `String at ${at} longer than maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) {
      return fail(at, `Number at ${at} below minimum ${schema.minimum}`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      return fail(at, `Number at ${at} above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.items) {
      const out: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        const child = validateAgainstSchema(schema.items, value[i], `${at}[${i}]`);
        if (!child.ok) return child;
        out.push(child.data);
      }
      return { ok: true, data: out as T };
    }
    return { ok: true, data: value as T };
  }

  if (typeof value === "object" && value !== null) {
    const props = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const key of required) {
      if (source[key] === undefined && !(key in props && "default" in (props[key] ?? {}))) {
        return fail(`${at}.${key}`, `Missing required property "${key}"`);
      }
    }

    for (const [key, propSchema] of Object.entries(props)) {
      if (source[key] === undefined && !("default" in propSchema)) {
        if (required.has(key)) {
          return fail(`${at}.${key}`, `Missing required property "${key}"`);
        }
        continue;
      }
      const child = validateAgainstSchema(
        propSchema,
        source[key] === undefined ? propSchema.default : source[key],
        `${at}.${key}`,
      );
      if (!child.ok) return child;
      out[key] = child.data;
    }

    const additional = schema.additionalProperties;
    for (const key of Object.keys(source)) {
      if (key in props) continue;
      if (additional === false) {
        return fail(`${at}.${key}`, `Unexpected property "${key}"`);
      }
      if (additional && typeof additional === "object") {
        const child = validateAgainstSchema(additional, source[key], `${at}.${key}`);
        if (!child.ok) return child;
        out[key] = child.data;
      } else {
        // additionalProperties true/undefined → allow passthrough
        out[key] = source[key];
      }
    }

    return { ok: true, data: out as T };
  }

  return { ok: true, data: value as T };
}
