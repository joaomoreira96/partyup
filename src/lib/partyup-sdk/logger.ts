type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production" && level === "debug") return;

  const payload = { scope: "partyup-sdk", ...context };
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  fn(`[PartyUp SDK] ${message}`, Object.keys(payload).length > 1 ? payload : "");
}

export const sdkLogger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
