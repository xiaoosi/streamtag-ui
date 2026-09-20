export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  modelNames: string[];
  port: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ModelConfig {
  const required = ['MODEL_BASE_URL', 'MODEL_API_KEY', 'MODEL_NAME'] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Set ${missing.join(', ')} in .env. See .env.example.`);
  }
  let url: URL;
  try {
    url = new URL(env.MODEL_BASE_URL!);
  } catch {
    throw new Error('MODEL_BASE_URL must be an absolute HTTP(S) API URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'MODEL_BASE_URL must be an HTTP(S) API URL without credentials, query, or fragment.',
    );
  }
  const modelNames = [
    ...new Set(
      env
        .MODEL_NAME!.split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (!modelNames.length || modelNames.some((name) => name.length > 100)) {
    throw new Error(
      'MODEL_NAME must contain one model ID, or comma-separated IDs, each up to 100 characters.',
    );
  }
  const port = Number(env.PORT || 5174);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer from 1 to 65535.');
  return {
    baseURL: url.href.replace(/\/$/, ''),
    apiKey: env.MODEL_API_KEY!.trim(),
    modelNames,
    port,
  };
}
