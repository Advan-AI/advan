export class MissingEnvError extends Error {
  constructor(public readonly variableName: string) {
    super(`Missing required environment variable: ${variableName}`)
    this.name = "MissingEnvError"
  }
}

export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim()
  if (!value) {
    throw new MissingEnvError(name)
  }
  return value
}

export function requireOneOfEnv(
  names: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): string {
  for (const name of names) {
    const value = env[name]?.trim()
    if (value) {
      return value
    }
  }
  throw new Error(`Missing required environment variable. Set one of: ${names.join(", ")}`)
}

export function requireIntEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  opts?: { min?: number }
): number {
  const raw = requireEnv(name, env)
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${raw}`)
  }
  if (opts?.min !== undefined && parsed < opts.min) {
    throw new Error(`Invalid value for ${name}: ${parsed}. Must be >= ${opts.min}`)
  }
  return parsed
}

export function requireNumberEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  opts?: { min?: number; max?: number }
): number {
  const raw = requireEnv(name, env)
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${name}: ${raw}`)
  }
  if (opts?.min !== undefined && parsed < opts.min) {
    throw new Error(`Invalid value for ${name}: ${parsed}. Must be >= ${opts.min}`)
  }
  if (opts?.max !== undefined && parsed > opts.max) {
    throw new Error(`Invalid value for ${name}: ${parsed}. Must be <= ${opts.max}`)
  }
  return parsed
}
