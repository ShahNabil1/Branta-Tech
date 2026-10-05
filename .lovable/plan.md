# Premium Book a Call Experience

## Goal
Replace the simple call-request form with a cinematic, availability-driven five-step booking experience using the supplied Vimeo video, while preserving truthful request-based confirmation.

## What will be built
- A poster-first Vimeo/direct-video introduction with Branta's existing sound control and reduced-motion behavior.
- A concise four-step “What happens in 30 minutes?” section.
- A five-step booking flow: details, needs, date, time, and review.
- Real bookable dates and timezone-aware slots generated from Branta availability rules and existing active bookings.
- A final server-side availability check plus database collision protection so two visitors cannot take the same slot.
- Confirmation showing the booking reference and selected details, without inventing a meeting link.
- Richer client booking cards showing references, duration, services, public notes, and confirmed meeting links only.
- Control Centre tools for weekly availability, exceptions, booking settings, editable media, service choices, and meeting-link/public-instruction management.

## Content and editing
- Seed the supplied Vimeo URL as the default intro media.
- Read service choices from published Services, with Control Centre selection controlling which appear.
- Store booking page media and booking rules in the existing external Supabase project.
- Keep uploaded assets in the existing public site media library; booking records remain private.

## Technical details
- Extend the existing `bookings` model and use dedicated availability rule/exception tables with sales-only access.
- Public availability is returned through validated server functions, not direct table access.
- Guest and signed-in submissions retain honeypot, rate limiting, input validation, and optional account linking.
- Admin writes remain protected by existing Sales/Admin permissions and database access rules.
- Add route-specific metadata and verify desktop, 390px mobile, keyboard flow, reduced motion, and unavailable-slot recovery.

## Boundaries
- No fake external calendar integration, payments, meeting links, emails, or WhatsApp delivery.
- No unrelated page redesign.
- Lovable Cloud will not be enabled or used.
