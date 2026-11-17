# AR Design: channel, chat monitor, Mini App — setup

Three modules were added to James. Nothing runs on a personal computer: Vercel (bot, Mini App, schedule) and GitHub Actions (chat monitor).

| Module | Code | Where it runs |
|---|---|---|
| Channel autoposting | `api/_lib/channel.js`, `api/_lib/channel_sources.js`, `api/channel_cron.js`, hooks in `api/telegram.js` | Vercel (webhook + Cron Mon/Wed/Fri 15:00 UTC) |
| Chat monitor (Telethon) | `agent/tg_monitor.py`, `agent/lead_filter.py`, `agent/tg_chats.json`, `.github/workflows/tg_leads.yml` | GitHub Actions, around the clock |
| Mini App | `miniapp/` (Next.js static export), `api/miniapp_lead.js` | Vercel (second project, `app.withardesign.com`) |

## 1. Variables

**Vercel, bot project (r-design-space-agent)** — new:
- `TELEGRAM_CHANNEL_ID` — `-100…` or `@handle` of the channel. Add the bot as channel **administrator** with the right to post.
- `MINIAPP_URL` — `https://app.withardesign.com` (CORS for the brief endpoint).
- `CRON_SECRET` — any long random string; Vercel Cron sends it as a bearer token to `/api/channel_cron`.

Already used and required: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (voice), `MEMORY_REPO`, `GH_MEMORY_TOKEN`.
Optional: `CHANNEL_MODEL`, `CHANNEL_FOOTER` (e.g. `withardesign.com`, appended to every post), `CHANNEL_STT_LANGUAGE`.

**Vercel, new project `ar-design-miniapp`** (Root Directory `miniapp`, framework Next.js, domain `app.withardesign.com`):
- `NEXT_PUBLIC_API_URL` — `https://<bot project>.vercel.app/api/miniapp_lead`.

**GitHub → Settings → Secrets and variables → Actions** — new for the chat monitor:
- `TG_API_ID`, `TG_API_HASH` — my.telegram.org → API development tools.
- `TG_SESSION` — run once on any computer: `pip install -r agent/requirements-monitor.txt && python agent/tg_login.py`, copy the printed line.
- Existing secrets reused: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`.

## 2. Channel autoposting

- Send the bot a screenshot or screen video **with a caption**, or without one and then a voice/text note within 15 minutes. A voice that replies to a media message also works.
- `/post` switches on "post mode" for 10 minutes (voice or text without media). `/idea` makes a note from fresh material right now.
- Every draft arrives with **Опубликовать / Переписать / Отменить**. Nothing reaches the channel without a tap.
- Posts are all lowercase except the brand `AR Design`, first person, no emoji, no exclamation marks (enforced in code, not only in the prompt).
- Vercel Cron runs Mon/Wed/Fri at 15:00 UTC (`vercel.json → crons`). Hobby plans allow one run per day per job, which fits. A backup trigger is possible: `GET /api/channel_cron?key=<CRON_URL_KEY>` from cron-job.org.
- Register the new commands in the menu once: `python agent/set_webhook.py https://<bot project>.vercel.app/api/telegram`.

## 3. Chat monitor

- Add chats to `agent/tg_chats.json` (`@username`, `https://t.me/name` or a numeric id). The account behind `TG_SESSION` must already be a member. The monitor only reads.
- The workflow `tg_leads.yml` runs every 10 minutes, each run ~9 minutes, so a lead card arrives within seconds. Start it once by hand: Actions → Telegram lead monitor → Run workflow.
- Keywords, stop words, minimum budget: `agent/config.json → tg_leads`.
- The repository is public: do not put anything secret into `tg_chats.json`. If it is private, change the schedule to every 30 minutes (Actions minutes quota).
- If Telegram revokes the session, you get one alert in the bot; run `tg_login.py` again and replace `TG_SESSION`.
- Test without sending: `python agent/tg_monitor.py --once --dry-run --verbose` (needs `agent/.env` with the same variables).

## 4. Mini App and @BotFather

Deploy: new Vercel project from this repository, Root Directory `miniapp`, add the domain `app.withardesign.com` (CNAME as Vercel shows).

@BotFather (the bot that serves the Mini App):
1. `/mybots` → the bot → **Bot Settings → Menu Button → Configure menu button** → URL `https://app.withardesign.com`, title `Open AR Design`.
2. **Bot Settings → Configure Mini App → Enable Mini App** → URL `https://app.withardesign.com`. This is the Main Mini App: an "Open app" button on the bot profile and the link `t.me/<bot>?startapp`.
3. Optional: `/newapp` for a direct link `t.me/<bot>/<short_name>`.
4. Full screen and "add to home screen" need Telegram 8.0+; older clients fall back to the normal window.

Leads from the Mini App arrive as a card (name, @username, task, budget, timing) with the button **Открыть диалог с клиентом**, and are saved to `leads.json`, so `/leads` and `/admin` see them.

Replace the placeholder works in `miniapp/lib/content.ts` (add `video` + `poster` per case, files in `miniapp/public/works`, videos under ~600 KB, muted, looping).
