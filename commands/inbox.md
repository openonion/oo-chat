---
name: inbox
description: Show unread emails from inbox
tools:
  - Gmail.search_emails
  - Gmail.get_email_body
---
Show emails from my inbox. For each email output exactly this markdown structure:

**{N}.** 🔵 **{Subject}** _(🔵 if unread, ⚪ if read)_
↳ {Sender name and address} · {Short date e.g. Mon 15 Jan}
> {One-sentence preview or summary of the email body}

Start the response with: **Inbox** · {count} email(s)

Keep previews under 120 characters. Use the real subject line verbatim.
