import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Clone the response so we can read the body without consuming it
    const clonedRes = res.clone();
    let errorMessage = res.statusText;
    
    try {
      // Try to parse the response as JSON and extract the message
      const errorData = await clonedRes.json();
      errorMessage = errorData.message || errorData.error || res.statusText;
    } catch (parseError) {
      // If JSON parsing fails, try to get the text
      try {
        const text = await res.text();
        errorMessage = text || res.statusText;
      } catch {
        // Use default statusText if all else fails
        errorMessage = res.statusText;
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use Go backend if VITE_API_URL is set, otherwise use default
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use Go backend if VITE_API_URL is set, otherwise use default
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const fullUrl = baseUrl ? `${baseUrl}${queryKey.join("/")}` : queryKey.join("/") as string;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Optimize caching based on query type
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes
      retry: (failureCount, error: any) => {
        // Only retry on network errors, not on 4xx errors
        if (error?.message?.startsWith('4')) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
      // Optimistic updates for better UX
      onError: (_error, _variables, context: any) => {
        // Rollback optimistic updates on error
        if (context?.rollback) {
          context.rollback();
        }
      },
    },
  },
});

// Custom invalidation helper for real-time updates
export function invalidateRealTimeQueries() {
  // Invalidate only time-sensitive queries
  queryClient.invalidateQueries({ queryKey: ['/api/user'] });
  queryClient.invalidateQueries({ queryKey: ['/api/mining'] });
  queryClient.invalidateQueries({ queryKey: ['/api/btc'] });
}
