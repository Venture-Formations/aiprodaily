# Orphaned secondary campaigns — AI Accounting Daily

_Generated 2026-09-10. Source: `system_logs` where `message = 'Failed to schedule final issue'`,
production (`vsbdfrqfokoltgjyiivq`)._

## What these are

Each row is a MailerLite campaign that was **created successfully** but whose schedule POST was
rejected with HTTP 422 (`The schedule date must be a date after or equal to <now>`). The failure was
swallowed, so the run reported success and stamped `secondary_sent_at`, but the campaign was never
scheduled.

**Caveat:** the database proves the schedule was rejected. Whether each campaign is *still* an
unsent draft could not be confirmed from here — the `MAILERLITE_API_KEY` in `.env.local` is expired
(401 on every endpoint). Verify in the MailerLite UI before deleting; some may have been sent by
hand at the time.

Two kinds:

- **Thursday secondary (intended)** — the real Thursday send. Configured for 05:25 CT but the job
  only finishes building the campaign at ~05:25:1x, so the requested time had just passed.
- **Bogus run — wrong day** — should never have existed. The send-day check read the weekday off a
  UTC clock, so from 19:00 CT onward it saw tomorrow's weekday and fired against the *current* day's
  already-sent issue, scheduling it for a time ~13 hours in the past.

Both causes are fixed as of this change; see `src/lib/date-utils.ts` (`getDayOfWeek`) and
`src/lib/mailerlite/mailerlite-service.ts` (`applyScheduleLeadGuard`).

## The list

| Created (CT) | MailerLite campaign ID | Issue date | Kind |
|---|---|---|---|
| 2026-09-10 Thu 05:25 | 198218561401914394 | 2026-09-10 | Thursday secondary |
| 2026-09-09 Wed 19:01 | 198179247913698418 | 2026-09-09 | Bogus — wrong day |
| 2026-09-03 Thu 05:25 | 197584382947493817 | 2026-09-03 | Thursday secondary |
| 2026-09-02 Wed 19:01 | 197545117739911103 | 2026-09-02 | Bogus — wrong day |
| 2026-08-27 Thu 05:25 | 196950159748236689 | 2026-08-27 | Thursday secondary |
| 2026-08-20 Thu 05:25 | 196315980879627466 | 2026-08-20 | Thursday secondary |
| 2026-08-19 Wed 19:01 | 196276718722352238 | 2026-08-19 | Bogus — wrong day |
| 2026-08-13 Thu 05:25 | 195681802390603625 | 2026-08-13 | Thursday secondary |
| 2026-08-12 Wed 19:03 | 195642663413745464 | 2026-08-12 | Bogus — wrong day |
| 2026-08-06 Thu 05:25 | 195047623405602657 | 2026-08-06 | Thursday secondary |
| 2026-08-05 Wed 19:01 | 195008361194849513 | 2026-08-05 | Bogus — wrong day |
| 2026-07-30 Thu 05:25 | 194413444821157464 | 2026-07-30 | Thursday secondary |
| 2026-07-29 Wed 19:01 | 194374183286736296 | 2026-07-29 | Bogus — wrong day |
| 2026-07-23 Thu 05:25 | 193779266127660953 | 2026-07-23 | Thursday secondary |
| 2026-07-22 Wed 19:01 | 193740004233577622 | 2026-07-22 | Bogus — wrong day |
| 2026-07-16 Thu 05:25 | 193145087245420522 | 2026-07-16 | Thursday secondary |
| 2026-07-15 Wed 19:01 | 193105823709267211 | 2026-07-15 | Bogus — wrong day |
| 2026-07-08 Wed 19:01 | 192471641375114368 | 2026-07-08 | Bogus — wrong day |
| 2026-07-02 Thu 05:25 | 191876729591039832 | 2026-07-02 | Thursday secondary |
| 2026-07-01 Wed 19:01 | 191837468384822765 | 2026-07-01 | Bogus — wrong day |
| 2026-06-26 Fri 08:53 | 191346229543700081 | 2026-06-26 | Bogus — wrong day |
| 2026-06-25 Thu 05:25 | 191242551298098513 | 2026-06-25 | Thursday secondary |
| 2026-06-24 Wed 19:01 | 191203287968515625 | 2026-06-24 | Bogus — wrong day |
| 2026-06-18 Thu 05:25 | 190608372137985503 | 2026-06-18 | Thursday secondary |
| 2026-06-17 Wed 19:01 | 190569113718883793 | 2026-06-17 | Bogus — wrong day |
| 2026-06-11 Thu 05:25 | 189974215728826339 | 2026-06-11 | Thursday secondary |
| 2026-06-10 Wed 19:00 | 189934894857586235 | 2026-06-10 | Bogus — wrong day |
| 2026-06-04 Thu 05:25 | 189340036582343793 | 2026-06-04 | Thursday secondary |
| 2026-06-03 Wed 19:00 | 189300715760387874 | 2026-06-03 | Bogus — wrong day |
| 2026-02-17 Tue 15:00 | 179686106312213697 | 2026-02-18 | Bogus — wrong day |
| 2025-12-12 Fri 05:25 | 173579910893274266 | 2025-12-12 | Bogus — wrong day |
| 2025-12-11 Thu 05:25 | 173489358587824036 | 2025-12-11 | Thursday secondary |
| 2025-12-10 Wed 18:00 | 173446262570354556 | 2025-12-10 | Bogus — wrong day |
| 2025-12-09 Tue 05:25 | 173308140595446798 | 2025-12-09 | Bogus — wrong day |
| 2025-12-08 Mon 18:00 | 173265044234045022 | 2025-12-08 | Bogus — wrong day |
| 2025-11-19 Wed 18:00 | 171543696353789525 | 2025-11-19 | Bogus — wrong day |

36 campaigns total. The weekly Thu/Wed pair pattern starts 2026-06-03; the 2025 rows predate the
current `secondary_send_days` configuration and have a scattered weekday spread.

## Regenerating

```sql
select
  to_char(l.timestamp at time zone 'America/Chicago','YYYY-MM-DD Dy HH24:MI') as created_ct,
  l.context->>'mailerliteissueId' as mailerlite_campaign_id,
  i.date as issue_date
from system_logs l
left join publication_issues i on i.id::text = l.context->>'issueId'
where l.message = 'Failed to schedule final issue'
order by l.timestamp desc;
```
