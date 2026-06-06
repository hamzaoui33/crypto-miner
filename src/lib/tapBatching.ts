import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Client-side tap batching utility
 * Accumulates taps locally and sends them to the backend in batches
 */
export interface TapBatch {
  clicks: number;
  energySpent: number;
  timestamp: number;
}

interface UseTapBatchingOptions {
  telegramUserId: number | null;
  enabled: boolean;
  onBatchSubmit: (batch: TapBatch) => Promise<void>;
}

interface UseTapBatchingReturn {
  accumulatedClicks: number;
  accumulatedEnergy: number;
  recordTap: (energyCost?: number) => void;
  flush: () => void;
  isSyncing: boolean;
}

const BATCH_INTERVAL_MS = 3000; // Send batch every 3 seconds

export function useTapBatching({
  telegramUserId,
  enabled,
  onBatchSubmit,
}: UseTapBatchingOptions): UseTapBatchingReturn {
  const accumulatedClicksRef = useRef(0);
  const accumulatedEnergyRef = useRef(0);
  const batchStartTimeRef = useRef<number>(Date.now());
  const [accumulatedClicks, setAccumulatedClicks] = useState(0);
  const [accumulatedEnergy, setAccumulatedEnergy] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to submit the current batch
  const flush = useCallback(async () => {
    if (!enabled || !telegramUserId) return;

    const clicks = accumulatedClicksRef.current;
    const energy = accumulatedEnergyRef.current;

    if (clicks === 0) return;

    setIsSyncing(true);

    try {
      await onBatchSubmit({
        clicks,
        energySpent: energy,
        timestamp: batchStartTimeRef.current,
      });

      // Reset the batch after successful submission
      accumulatedClicksRef.current = 0;
      accumulatedEnergyRef.current = 0;
      batchStartTimeRef.current = Date.now();
      setAccumulatedClicks(0);
      setAccumulatedEnergy(0);
    } catch (error) {
      console.error("[tap-batch] Failed to submit batch", { error });
      // Don't reset on error, try again next time
    } finally {
      setIsSyncing(false);
    }
  }, [enabled, telegramUserId, onBatchSubmit]);

  // Schedule the next batch submission
  const scheduleNextBatch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      flush();
    }, BATCH_INTERVAL_MS);
  }, [flush]);

  // Record a new tap
  const recordTap = useCallback(
    (energyCost: number = 1) => {
      if (!enabled) return;

      accumulatedClicksRef.current += 1;
      accumulatedEnergyRef.current += energyCost;
      setAccumulatedClicks(accumulatedClicksRef.current);
      setAccumulatedEnergy(accumulatedEnergyRef.current);

      // Start or reset the batch timer
      scheduleNextBatch();
    },
    [enabled, scheduleNextBatch]
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // Try to flush on unmount (best effort)
      if (accumulatedClicksRef.current > 0 && enabled && telegramUserId) {
        flush();
      }
    };
  }, [enabled, telegramUserId, flush]);

  return {
    accumulatedClicks,
    accumulatedEnergy,
    recordTap,
    flush,
    isSyncing,
  };
}