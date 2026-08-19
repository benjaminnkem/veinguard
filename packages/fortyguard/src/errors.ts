import type { ErrorCode } from "@repo/contracts";

export type FortyGuardErrorKind =
  | "UNAVAILABLE"
  | "REQUEST_INVALID"
  | "ACTIVITY_FAILED"
  | "AMBIGUOUS_POST"
  | "TIMEOUT"
  | "RESPONSE_INVALID";

export class FortyGuardError extends Error {
  readonly kind: FortyGuardErrorKind;
  readonly errorCode: ErrorCode;
  readonly providerStatus?: number;

  constructor(
    kind: FortyGuardErrorKind,
    message: string,
    options?: { cause?: unknown; providerStatus?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "FortyGuardError";
    this.kind = kind;
    this.providerStatus = options?.providerStatus;
    this.errorCode = kindToCode(kind);
  }
}

function kindToCode(kind: FortyGuardErrorKind): ErrorCode {
  switch (kind) {
    case "UNAVAILABLE":
      return "THERMAL_PROVIDER_UNAVAILABLE";
    case "REQUEST_INVALID":
      return "THERMAL_REQUEST_INVALID";
    case "ACTIVITY_FAILED":
    case "TIMEOUT":
    case "AMBIGUOUS_POST":
    case "RESPONSE_INVALID":
      return "THERMAL_ACTIVITY_FAILED";
  }
}

export function safeProviderMessage(status: number, bodyText: string): string {
  const trimmed = bodyText.replace(/\s+/g, " ").slice(0, 180);
  if (status === 401 || status === 403) {
    return "FortyGuard rejected the API key.";
  }
  if (status === 400) {
    return "FortyGuard rejected the request as invalid.";
  }
  if (status === 429) {
    return "FortyGuard rate-limited the request.";
  }
  if (status >= 500) {
    return "FortyGuard is unavailable.";
  }
  return trimmed.length > 0
    ? `FortyGuard returned HTTP ${status}.`
    : `FortyGuard returned HTTP ${status}.`;
}
