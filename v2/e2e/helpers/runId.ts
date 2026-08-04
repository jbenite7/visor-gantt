const RUN_ID = `run-${process.env.PLAYWRIGHT_RUN_ID ?? Date.now().toString(36)}`;

export function e2eRunId(): string {
  return RUN_ID;
}

export function e2eProjectName(prefix: string, detail?: string): string {
  return [prefix, RUN_ID, detail].filter(Boolean).join(" ");
}
