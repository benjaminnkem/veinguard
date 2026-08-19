import type { ErrorCode } from "@repo/contracts";

export type AgentErrorKind =
  | "UNAVAILABLE"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "RESPONSE_INVALID"
  | "REQUEST_INVALID"
  | "LIMIT_REACHED"
  | "NO_FEASIBLE"
  | "SIMULATION_FAILED"
  | "CONSTRAINT_REJECTED";

export class AgentError extends Error {
  readonly kind: AgentErrorKind;
  readonly errorCode: ErrorCode;
  readonly providerStatus?: number;

  constructor(
    kind: AgentErrorKind,
    message: string,
    options?: { cause?: unknown; providerStatus?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AgentError";
    this.kind = kind;
    this.providerStatus = options?.providerStatus;
    this.errorCode = kindToCode(kind);
  }
}

function kindToCode(kind: AgentErrorKind): ErrorCode {
  switch (kind) {
    case "UNAVAILABLE":
    case "RATE_LIMIT":
    case "TIMEOUT":
    case "RESPONSE_INVALID":
      return "AGENT_UNAVAILABLE";
    case "LIMIT_REACHED":
      return "AGENT_LIMIT_REACHED";
    case "NO_FEASIBLE":
      return "AGENT_NO_FEASIBLE_SCENARIO";
    case "REQUEST_INVALID":
    case "CONSTRAINT_REJECTED":
      return "SCENARIO_INVALID_INTERVENTION";
    case "SIMULATION_FAILED":
      return "SIMULATION_CONVERGENCE_FAILED";
  }
}
