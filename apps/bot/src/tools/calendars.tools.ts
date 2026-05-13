import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const CALENDAR_EVENT_TYPES = [
  "meeting",
  "partner_meeting",
  "interview",
  "health_check",
  "flight",
  "training_class",
  "exam",
  "other",
] as const;

export const CALENDAR_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "postponed",
] as const;

export const calendarTools = createCrudTools({
  slug: "calendars",
  label: { singular: "lịch", plural: "lịch" },
  titleField: "title",
  filterableFields: ["title", "eventType", "status", "location"],
  inputSchema: {
    title: z.string().describe("Tiêu đề sự kiện"),
    eventType: z.enum(CALENDAR_EVENT_TYPES).describe(
      "meeting=họp NB, partner_meeting=họp đối tác, interview=phỏng vấn, health_check=khám SK, flight=bay XC, training_class=lớp đào tạo, exam=thi tuyển, other=khác",
    ),
    status: z.enum(CALENDAR_STATUSES).optional(),
    startAt: z.string().describe("ISO 8601 datetime với timezone +07:00, vd 2026-05-14T09:00:00+07:00"),
    endAt: z.string().optional().describe("ISO 8601 datetime, để trống nếu không xác định giờ kết thúc"),
    allDay: z.boolean().optional(),
    location: z.string().optional().describe("Địa điểm vật lý"),
    meetingLink: z.string().optional().describe("Link online (Google Meet, Zoom...)"),
    description: z.string().optional().describe("Agenda / nội dung"),
    remindBeforeMinutes: z.number().int().nonnegative().optional().describe(
      "Số phút trước event sẽ gửi nhắc cho attendees. Để trống = không nhắc.",
    ),
    relatedOrderId: z.string().optional(),
    relatedContractId: z.string().optional(),
  },
});
