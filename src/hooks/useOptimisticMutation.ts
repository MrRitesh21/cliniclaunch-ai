import { useState, useCallback } from "react";
import { toast } from "sonner";

interface OptimisticMutationOptions<T, P> {
  onMutate: (payload: P, currentData: T) => T;
  mutationFn: (payload: P) => Promise<any>;
  onSuccess?: (result: any, payload: P) => void;
  onError?: (error: Error, payload: P) => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticMutation<T, P>(
  initialData: T,
  options: OptimisticMutationOptions<T, P>,
) {
  const [data, setData] = useState<T>(initialData);
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    async (payload: P) => {
      const previousData = data;
      const optimisticData = options.onMutate(payload, previousData);

      // Apply optimistic update immediately
      setData(optimisticData);
      setIsPending(true);

      try {
        const result = await options.mutationFn(payload);
        setIsPending(false);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        if (options.onSuccess) {
          options.onSuccess(result, payload);
        }
        return result;
      } catch (err: any) {
        // Rollback optimistic update on error
        setData(previousData);
        setIsPending(false);
        const msg = options.errorMessage || err.message || "Action failed. Rolled back.";
        toast.error(msg);
        if (options.onError) {
          options.onError(err, payload);
        }
      }
    },
    [data, options],
  );

  return {
    data,
    setData,
    mutate,
    isPending,
  };
}
