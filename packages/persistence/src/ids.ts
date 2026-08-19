import { randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
