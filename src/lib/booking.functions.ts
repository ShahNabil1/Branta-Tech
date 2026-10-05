import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { parseBookingSettings, type BookingDay } from "@/lib/booking";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

type Rule = { day_of_week: number; start_time: string; end_time: string };
type Exception = { exception_date: string; kind: string; start_time: string | null; end_time: string | null };

function partsAt(iso: string | Date, timeZone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(typeof iso === "string" ? new Date(iso) : iso).map((p) => [p.type, p.value]));
}

/** Convert an office wall-clock value into UTC, including DST offsets. */
function localToIso(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh == null || mm == null) return null;
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i += 1) {
    const p = partsAt(new Date(guess), timeZone);
    const shown = Date.UTC(Number(p["year"]), Number(p["month"]) - 1, Number(p["day"]), Number(p["hour"]), Number(p["minute"]));
    guess -= shown - Date.UTC(y, m - 1, d, hh, mm);
  }
  return new Date(guess).toISOString();
}

function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function officeDate(now: Date, timezone: string) {
  const p = partsAt(now, timezone);
  return `${p["year"]}-${p["month"]}-${p["day"]}`;
}

function clockMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function slotsForDate(date: string, timezone: string, duration: number, buffer: number, notice: number, rules: Rule[], exceptions: Exception[], busy: { start: number; end: number }[]) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayExceptions = exceptions.filter((e) => e.exception_date === date);
  const fullyBlocked = dayExceptions.some((e) => e.kind === "blocked" && !e.start_time);
  if (fullyBlocked) return [];
  const special = dayExceptions.filter((e) => e.kind === "available" && e.start_time && e.end_time);
  const windows = special.length ? special.map((e) => ({ start_time: e.start_time as string, end_time: e.end_time as string })) : rules.filter((r) => r.day_of_week === day);
  const blocks = dayExceptions.filter((e) => e.kind === "blocked" && e.start_time && e.end_time);
  const earliest = Date.now() + notice * 3_600_000;
  const out: string[] = [];
  for (const w of windows) {
    for (let mins = clockMinutes(w.start_time); mins + duration <= clockMinutes(w.end_time); mins += duration + buffer) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      const local = `${hh}:${mm}`;
      const blocked = blocks.some((b) => mins < clockMinutes(b.end_time as string) && mins + duration > clockMinutes(b.start_time as string));
      const iso = localToIso(date, local, timezone);
      if (!iso || blocked) continue;
      const start = new Date(iso).getTime();
      const end = start + duration * 60_000;
      if (start < earliest || busy.some((b) => start < b.end + buffer * 60_000 && end + buffer * 60_000 > b.start)) continue;
      out.push(iso);
    }
  }
  return out;
}

export const getBookingExperience = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  if (!sb) return { settings: parseBookingSettings(null), services: [] as string[], days: [] as BookingDay[] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: setting }, { data: services }, { data: rules }, { data: exceptions }] = await Promise.all([
    sb.from("site_settings").select("settings").eq("setting_group", "booking").maybeSingle(),
    sb.from("services").select("name").eq("status", "published").order("sort_order"),
    supabaseAdmin.from("booking_availability_rules").select("day_of_week,start_time,end_time").eq("enabled", true).order("sort_order"),
    supabaseAdmin.from("booking_availability_exceptions").select("exception_date,kind,start_time,end_time"),
  ]);
  const settings = parseBookingSettings(setting?.settings);
  const published = (services ?? []).map((s) => s.name);
  const selected = settings.enabledServices.length ? published.filter((name) => settings.enabledServices.includes(name)) : published;
  const displayServices = [...selected, ...(settings.enabledServices.includes("Something Else") ? ["Something Else"] : [])];
  const startDate = officeDate(new Date(), settings.timezone);
  const endIso = localToIso(addDays(startDate, settings.maximumAdvanceDays + 1), "00:00", settings.timezone) ?? new Date(Date.now() + 32 * 86400_000).toISOString();
  const { data: rows } = await supabaseAdmin.from("bookings").select("requested_start_at,duration_minutes,status")
    .gte("requested_start_at", new Date().toISOString()).lt("requested_start_at", endIso).in("status", ["requested", "confirmed", "reschedule_requested"]);
  const busy = (rows ?? []).map((b) => ({ start: new Date(b.requested_start_at).getTime(), end: new Date(b.requested_start_at).getTime() + b.duration_minutes * 60_000 }));
  const days: BookingDay[] = [];
  for (let i = 0; i <= settings.maximumAdvanceDays; i += 1) {
    const date = addDays(startDate, i);
    const isos = slotsForDate(date, settings.timezone, settings.durationMinutes, settings.bufferMinutes, settings.minimumNoticeHours, rules ?? [], exceptions ?? [], busy);
    if (isos.length) days.push({ date, slots: isos.map((iso) => ({ iso, label: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: settings.timezone }).format(new Date(iso)) })) });
  }
  if (settings.introMedia[0]?.type === "vimeo" && !settings.introMedia[0].poster_url) {
    const { vimeoId } = await import("@/lib/hero");
    const id = vimeoId(settings.introMedia[0].url);
    if (id) {
      const { vimeoThumb } = await import("@/lib/vimeo.server");
      settings.introMedia[0] = { ...settings.introMedia[0], poster_url: (await vimeoThumb(id)) ?? "" };
    }
  }
  return { settings, services: displayServices.length ? displayServices : ["Something Else"], days };
});

export const bookingExperienceQuery = queryOptions({
  queryKey: ["public", "booking-experience"],
  queryFn: () => getBookingExperience(),
  staleTime: 30_000,
});