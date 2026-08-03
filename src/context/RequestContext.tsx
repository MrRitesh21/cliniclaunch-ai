import React, { createContext, useContext, ReactNode, useMemo } from "react";

export interface RequestContextValue {
  correlationId: string;
  timestamp: number;
  tenantId?: string;
  clinicId?: string;
}

const RequestContext = createContext<RequestContextValue>({
  correlationId: "req-init",
  timestamp: Date.now(),
});

export function RequestContextProvider({
  children,
  tenantId,
  clinicId,
}: {
  children: ReactNode;
  tenantId?: string;
  clinicId?: string;
}) {
  const value = useMemo<RequestContextValue>(() => {
    return {
      correlationId: `req-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      tenantId,
      clinicId,
    };
  }, [tenantId, clinicId]);

  return <RequestContext.Provider value={value}>{children}</RequestContext.Provider>;
}

export function useRequestContext(): RequestContextValue {
  return useContext(RequestContext);
}
