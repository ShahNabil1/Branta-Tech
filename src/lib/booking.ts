import { parseMediaItems, type SectionMediaItem } from "@/lib/section-media";

export const DEFAULT_BOOKING_VIDEO = "https://vimeo.com/1232979935?share=copy&fl=sv&fe=ci";

export type BookingSettings = {
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  maximumAdvanceDays: number;
  instantConfirmation: boolean;
  enabledServices: string[];
  introMedia: SectionMediaItem[];
  processMedia: SectionMediaItem[];
};

export type BookingSlot = { iso: string; label: string; booked?: boolean };
export type BookingDay = { date: string; slots: BookingSlot[] };

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export function parseBookingSettings(raw: unknown): BookingSettings {
  const o = obj(raw);
  const services = Array.isArray(o["services"])
    ? o["services"].filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()).slice(0, 30)
    : [];
  const fallbackMedia = [{
    id: "booking-intro", type: "vimeo", url: DEFAULT_BOOKING_VIDEO, poster_url: "",
    alt: "A Branta discovery call", label: "This is what working with Branta feels like.", caption: "",
    enabled: true, sort_order: 0, autoplay: true, muted: true, loop: true, aspect: "16:9", position: "center",
  }];
  return {
    timezone: typeof o["timezone"] === "string" && o["timezone"].trim() ? o["timezone"].trim() : "Asia/Dhaka",
    durationMinutes: int(o["duration_minutes"], 30, 15, 180),
    bufferMinutes: int(o["buffer_minutes"], 15, 0, 120),
    minimumNoticeHours: int(o["minimum_notice_hours"], 12, 0, 336),
    maximumAdvanceDays: int(o["maximum_advance_days"], 30, 1, 365),
    instantConfirmation: o["instant_confirmation"] === true,
    enabledServices: services,
    introMedia: parseMediaItems({ media_items: Array.isArray(o["intro_media"]) ? o["intro_media"] : fallbackMedia }, true),
    processMedia: parseMediaItems({ media_items: Array.isArray(o["process_media"]) ? o["process_media"] : [] }, true),
  };
}

export function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    requested: "Awaiting confirmation",
    confirmed: "Confirmed",
    reschedule_requested: "Reschedule requested",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "Not attended",
  };
  return labels[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}