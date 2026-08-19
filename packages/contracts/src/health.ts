export interface HealthCheck {
  name: string;
  status: "up" | "down" | "skipped";
  detail?: string;
}

export interface HealthLiveData {
  status: "ok";
  service: string;
}

export interface HealthReadyData {
  status: "ready" | "not_ready";
  service: string;
  checks: HealthCheck[];
}
