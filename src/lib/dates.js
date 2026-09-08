// Dates — the one rule and the one function every date column goes through.
// Moved out of App.jsx unchanged (2026-09-08).
//
// The bug this exists for: an evening signup compared profiles.created_at (a
// UTC timestamp) against the local day string and concluded the account was
// created "tomorrow" — Home's week rail marked the user's own first day as
// pre-creation. Any comparison between a timestamptz and a date column must
// convert the timestamp to the LOCAL day first (localDate(new Date(ts))),
// never slice the ISO string. The same rule in Swift: Calendar.current in the
// device time zone for every *_date column, never ISO8601 UTC components.
//
// Related helpers that stay where they are: weekDays (lib/weekSummary.js)
// builds the Mon–Sun spine; `today` in App is computed once per mount (known
// issue #8) and callers that must be exact call localDate() themselves.

// Every date column in this app stores the user's LOCAL day. toISOString()
// returns the UTC day, which is already tomorrow for anyone west of UTC logging
// in the evening. "en-CA" formats local time as YYYY-MM-DD. Writes, read
// filters and comparisons all go through this so they cannot drift apart.
export const localDate=(d=new Date())=>d.toLocaleDateString("en-CA");
