---
name: search
description: Search emails by keywords or date range
tools:
  - Gmail.search_emails
  - Gmail.get_email_body
---
Search emails based on the user's query. Support:
- Keywords in subject or body
- Date ranges (natural language like "last week", "this month")
- Sender filtering

Format results as:
1. **[Date]** From [Sender]: [Subject]
   Summary: [1-line summary]
