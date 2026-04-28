import type { CollectionBeforeChangeHook } from "payload";

/**
 * Khi Order tạo mới → set stageStartedAt = now và reset remindersSent.
 * Khi update mà status đổi → reset cả 2.
 *
 * Cron worker dùng `stageStartedAt` để tính số ngày ở bước hiện tại,
 * so với `WorkflowStage.durationDays` để biết khi nào nhắc / báo trễ.
 */
export const trackStageTiming: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (operation === "create") {
    if (!data.stageStartedAt) data.stageStartedAt = new Date().toISOString();
    data.remindersSent = [];
    return data;
  }
  if (operation === "update") {
    const prev = originalDoc?.status;
    const next = data?.status;
    if (prev && next && prev !== next) {
      data.stageStartedAt = new Date().toISOString();
      data.remindersSent = [];
    }
  }
  return data;
};
