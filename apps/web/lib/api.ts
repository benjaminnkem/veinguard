import axios, { AxiosError } from "axios";
import { publicEnv } from "./public-env";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface ApiSuccessBody<T> {
  data: T;
  meta?: { correlationId?: string };
}

export const api = axios.create({
  baseURL: publicEnv.apiBaseUrl,
  headers: { Accept: "application/json" },
});

api.interceptors.response.use(
  (response) => {
    const body = response.data as ApiSuccessBody<unknown> | unknown;
    if (body && typeof body === "object" && "data" in body) {
      response.data = (body as ApiSuccessBody<unknown>).data;
    }
    return response;
  },
  (error: AxiosError<ApiErrorBody>) => {
    const message =
      error.response?.data?.error?.message ??
      error.message ??
      "Request failed.";
    return Promise.reject(new Error(message));
  },
);
