// Minimal JSONSchema7 type for local use (if not installed from package)
export type JSONSchema7 = {
  $id?: string;
  $schema?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema7>;
  items?: JSONSchema7 | JSONSchema7[];
  required?: string[];
  additionalProperties?: boolean | JSONSchema7;
  description?: string;
  title?: string;
  enum?: unknown[];
  allOf?: JSONSchema7[];
  anyOf?: JSONSchema7[];
  oneOf?: JSONSchema7[];
  not?: JSONSchema7;
  definitions?: Record<string, JSONSchema7>;
  // ...extend as needed
  [key: string]: unknown;
};
