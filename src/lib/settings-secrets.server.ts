const READ_METADATA_PREFIX = "__configured_";

/** Public IDs are not secrets; private tokens/passwords/API keys never round-trip. */
export function isSecretSettingKey(key: string): boolean {
  return /(?:^|_)(?:secret|password|private_key|token|api_key|service_role_key|database_url|connection_string)(?:_|$)/i.test(key);
}

export function redactSystemSettings(settings: Record<string, string | null | undefined>): Record<string, string> {
  const visible: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(settings)) {
    const value = rawValue ?? "";
    if (key.startsWith(READ_METADATA_PREFIX)) continue;
    if (isSecretSettingKey(key)) {
      visible[key] = "";
      visible[`${READ_METADATA_PREFIX}${key}`] = value ? "true" : "false";
    } else {
      visible[key] = value;
    }
  }
  return visible;
}

/** Blank private fields mean preserve; changing a credential requires a replacement. */
export function writableSystemSettings(settings: Record<string, string>): Array<[string, string]> {
  return Object.entries(settings).filter(([key, value]) =>
    !key.startsWith(READ_METADATA_PREFIX) && !(isSecretSettingKey(key) && !value.trim()),
  );
}
