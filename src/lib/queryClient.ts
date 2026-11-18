import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds default for lists
      gcTime: 10 * 60 * 1000, // 10 minutes cache garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
