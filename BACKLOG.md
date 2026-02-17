# Product Backlog — Road Trip Planner

Prioritized feature list. **P1** = next up, **P2** = soon, **P3** = later.

---

## P1 — End date calendar: min = start date ✅ Implemented

**What:** The trip end date picker must not allow choosing a date before the trip start date. The calendar (and validation) should enforce: end date ≥ start date.  
**Why:** Prevents invalid ranges (e.g. end 02/16/2026 when start is 06/02/2026) and avoids confusion.  
**Where:** Step 1 (Trip Basics) — set `min` on the end date `<input type="date">` to the current start date value.  
**Acceptance:**  
- [x] When start date is set, end date picker does not allow selecting a date before start date.  
- [x] If start date is changed to after current end date, end date is cleared so the range stays valid.

---

## P1 — Edit trip details

**What:** User can edit the trip summary shown in the sidebar (Pic 1): trip name, start date, end date.  
**Why:** Fix mistakes without recreating the trip (e.g. wrong dates like 6/1–6/19 vs 6/2–6/20).  
**Where:** Sidebar header (trip name, date range, “X days”) — add an edit control (e.g. pencil icon or click-to-edit).  
**Acceptance:**  
- [ ] Edit trip name and save.  
- [ ] Edit start/end dates; regenerate day list and preserve activities where dates still fall in range.  
- [ ] Changes persist (localStorage / future backend).

---

## P1 — Day-level detail: click into a day, type (driving / destination), and details

**What:** Click a day card (Pic 2) to open a day view where the user can:  
- Mark the day as **driving day**, **destination day**, or similar.  
- Enter details appropriate to that type (e.g. drive hours, overnight location, notes).  
**Why:** Matches how people plan (by day type) and sets up validation (e.g. lodging vs driving).  
**Where:** Day cards in Sidebar → open day detail panel/modal; optional main-area view when a day is selected.  
**Acceptance:**  
- [ ] Clicking a day opens a day-detail view (panel or modal).  
- [ ] Day type can be set (e.g. Driving day / Destination day / Rest day) and saved.  
- [ ] Fields for that type (e.g. “Drive to”, “Hours”, “Overnight at”, notes) are available and persisted.  
- [ ] Existing “add activity” flow still works; day type and details complement it.

**Notes:** May extend `Day` in `types/index.ts` (e.g. `dayType`, `drivingHours`, `dayNotes`).

---

## P2 — Import pre-planned itinerary (Excel)

**What:** User can upload an Excel file (e.g. `.xlsx`) and map columns to trip/days/activities so the app creates or updates a trip from their existing plan.  
**Why:** Many users already have a spreadsheet; import reduces re-entry and increases adoption.  
**Where:** Trips list or trip view — e.g. “Import from Excel” action; wizard to map columns and preview before applying.  
**Acceptance:**  
- [ ] Upload `.xlsx` (and optionally `.csv`).  
- [ ] User maps columns (e.g. Date, Day, Location, Notes, Type).  
- [ ] Preview imported days/activities; user confirms.  
- [ ] Import creates a new trip or merges into current trip without overwriting unrelated data.

**Notes:** Consider a library such as `xlsx` or SheetJS for parsing; keep file size limits and validation.

---

## P3 — AI assistant

**What:** In-app AI assistant the user can “talk with” (chat) for help planning: suggestions, answers, validation in natural language.  
**Why:** Listed in PRD as Phase 2; differentiator once core data and validation are solid.  
**Where:** Persistent chat entry (e.g. floating button or sidebar panel); conversation context can be current trip.  
**Acceptance:**  
- [ ] User can open a chat and send messages.  
- [ ] Assistant responds in context (e.g. trip dates, days, activities) where appropriate.  
- [ ] Assistant can suggest edits or next steps; user can accept or ignore.  
- [ ] Clear handling of rate limits, errors, and cost (if using paid API).

**Notes:** PRD currently has “AI Assistant” in “Skipped for MVP (Phase 2)”. Implement after P1–P2 and when data quality/validation are stable.

---

## Summary

| Priority | Feature                         | Rationale                          |
|----------|---------------------------------|------------------------------------|
| **P1**   | End date calendar min = start date | Prevents invalid date range         |
| **P1**   | Edit trip details               | Quick win, fixes date/name errors  |
| **P1**   | Day detail + driving/destination | Core to day-by-day planning        |
| **P2**   | Import Excel itinerary          | High value, medium effort          |
| **P3**   | AI assistant                    | Phase 2 per PRD; larger scope      |

*Last updated: Feb 2026*
