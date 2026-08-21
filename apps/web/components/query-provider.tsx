"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
  { ssr: false },
);

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <div className="flex h-full min-h-0 flex-1 flex-col">{children}</div>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
