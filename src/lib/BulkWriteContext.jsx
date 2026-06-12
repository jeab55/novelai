import React, { createContext, useContext, useState, useCallback } from "react";

const BulkWriteContext = createContext(null);

// shape: { [novelId]: { status: "running"|"done"|"error", current: number, total: number, doneCount: number, errorCount: number } }
export function BulkWriteProvider({ children }) {
  const [jobs, setJobs] = useState({});

  const startJob = useCallback((novelId, total) => {
    setJobs((prev) => ({
      ...prev,
      [novelId]: { status: "running", current: 0, total, doneCount: 0, errorCount: 0 },
    }));
  }, []);

  const updateJob = useCallback((novelId, patch) => {
    setJobs((prev) => ({
      ...prev,
      [novelId]: { ...prev[novelId], ...patch },
    }));
  }, []);

  const finishJob = useCallback((novelId, { doneCount, errorCount }) => {
    setJobs((prev) => ({
      ...prev,
      [novelId]: {
        ...prev[novelId],
        status: errorCount > 0 && doneCount === 0 ? "error" : "done",
        doneCount,
        errorCount,
      },
    }));
  }, []);

  const clearJob = useCallback((novelId) => {
    setJobs((prev) => {
      const next = { ...prev };
      delete next[novelId];
      return next;
    });
  }, []);

  return (
    <BulkWriteContext.Provider value={{ jobs, startJob, updateJob, finishJob, clearJob }}>
      {children}
    </BulkWriteContext.Provider>
  );
}

export function useBulkWrite() {
  return useContext(BulkWriteContext);
}