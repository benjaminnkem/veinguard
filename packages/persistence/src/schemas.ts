import { Schema } from "mongoose";
import { USER_ROLES, RUN_STATUSES } from "@repo/contracts";
import { newId } from "./ids";

export const OrganizationSchema = new Schema(
  {
    _id: { type: String, default: newId },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "organizations", versionKey: false },
);

export const UserSchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, required: true, index: true },
    emailNormalized: { type: String, required: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    role: { type: String, required: true, enum: USER_ROLES },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "users", versionKey: false },
);
UserSchema.index({ organizationId: 1, emailNormalized: 1 }, { unique: true });

export const RefreshTokenSchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    replacedByHash: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "refreshTokens", versionKey: false },
);

export const JobSchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    status: { type: String, required: true, enum: RUN_STATUSES, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, default: null },
    correlationId: { type: String, required: true },
    bullJobId: { type: String, default: null },
    attempt: { type: Number, default: 0 },
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { collection: "jobs", versionKey: false },
);
JobSchema.index({ organizationId: 1, idempotencyKey: 1, type: 1 }, {
  unique: true,
  partialFilterExpression: { idempotencyKey: { $type: "string" } },
});

export const IdempotencySchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, required: true },
    key: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    requestHash: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    statusCode: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "idempotencyKeys", versionKey: false },
);
IdempotencySchema.index({ organizationId: 1, key: 1, method: 1, path: 1 }, { unique: true });

export const AuditLogSchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, default: null, index: true },
    actorUserId: { type: String, default: null },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    correlationId: { type: String, required: true },
    ip: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "auditLogs", versionKey: false },
);

export const SimulationRunSchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: RUN_STATUSES },
    networkId: { type: String, required: true },
    chemistryProfile: { type: String, required: true },
    thermalAcquisitionId: { type: String, default: null },
    summary: { type: Schema.Types.Mixed, default: null },
    provenance: { type: Schema.Types.Mixed, default: null },
    correlationId: { type: String, required: true },
    jobId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "simulationRuns", versionKey: false },
);
SimulationRunSchema.index({ organizationId: 1, createdAt: -1 });
SimulationRunSchema.index({ status: 1, createdAt: -1 });

export const AgentRunSchema = new Schema(
  {
    _id: { type: String, default: newId },
    organizationId: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: RUN_STATUSES, index: true },
    outcome: { type: String, default: null },
    goal: { type: String, required: true },
    structuredConstraints: { type: Schema.Types.Mixed, default: {} },
    baselineRunId: { type: String, required: true, index: true },
    modelId: { type: String, required: true },
    compactBaseline: { type: Schema.Types.Mixed, default: null },
    compactNetwork: { type: Schema.Types.Mixed, default: null },
    selectedScenarioRunId: { type: String, default: null },
    rationale: { type: String, default: null },
    scenarioRunIds: { type: [String], default: [] },
    correlationId: { type: String, required: true },
    jobId: { type: String, default: null },
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { collection: "agentRuns", versionKey: false },
);
AgentRunSchema.index({ organizationId: 1, createdAt: -1 });

export const AgentEventSchema = new Schema(
  {
    _id: { type: String, default: newId },
    agentRunId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    sequence: { type: Number, required: true },
    type: { type: String, required: true },
    timestamp: { type: String, required: true },
    displayMessage: { type: String, required: true },
    toolName: { type: String, default: null },
    scenarioRunId: { type: String, default: null },
    argsHash: { type: String, default: null },
    resultSummary: { type: Schema.Types.Mixed, default: null },
  },
  { collection: "agentEvents", versionKey: false },
);
AgentEventSchema.index({ agentRunId: 1, sequence: 1 }, { unique: true });

export const MODEL_NAMES = {
  Organization: "Organization",
  User: "User",
  RefreshToken: "RefreshToken",
  Job: "Job",
  Idempotency: "Idempotency",
  AuditLog: "AuditLog",
  SimulationRun: "SimulationRun",
  AgentRun: "AgentRun",
  AgentEvent: "AgentEvent",
} as const;
