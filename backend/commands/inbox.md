---
name: inbox
description: Show unread emails from inbox
tools:
  - Gmail.search_emails
  - Gmail.get_email_body
---
Show emails from my inbox as a markdown table, like Gmail's inbox view.

Start with: **Inbox** · {count} email(s)

Then output this exact table:

| | From | Subject | Date |
|:--|:--|:--|--:|
| 🔵 | **Sender Name** | **Subject line**  preview snippet | 15 Jan |
|    | Sender Name | Subject line  preview snippet | 14 Jan |

Rules:
- 🔵 in the first column if unread, blank if read
- Sender name only (not the email address), bold if unread
- Subject bold if unread; append 2 spaces then a short snippet (under 80 chars, ending in ... if truncated) in the same cell
- Date right-aligned, short format: "15 Jan" or "Mon" if today
- Use the real subject line verbatim
