# Subscription Checker

Check an email inbox for recurring senders. Follow these steps in order.

## Steps

1. Run `read_memory("subscriptions:all")`. If results exist, return them immediately and stop.

2. If memory is empty, run `search_emails("unsubscribe OR subscription OR newsletter", 50)`.

3. Group results by sender email. Only keep senders with 2+ emails. Sort by count descending.

4. For each sender with 2+ emails, run `get_email_body(email_id)` on their most recent email. Extract:
   - Unsubscribe link: check List-Unsubscribe header first, then search body for links with "unsubscribe", "opt-out", or "manage preferences"
   - Email web link: URL to view this email in Gmail

5. Classify each sender as one of: spam, marketing, newsletter, gaming, transactional, social

6. Run `write_memory("subscriptions:all", results)` to save everything.

7. Format the results exactly like this example:

```
Subscription check complete. Here are the subscriptions I found in your recent emails:

### Gaming
- **Fragsworth** (`fragsworth@e.playsaurus.com`): [Unsubscribe](<URL>) | [View Email](<URL>)
- **Steam** (`noreply@steampowered.com`): No direct unsubscribe link. | [View Email](<URL>)

### Marketing & Retail
- **adidas** (`adidas@au-news.adidas.com`): [Unsubscribe](<URL>) | [View Email](<URL>)

### Newsletters
- **Plugin Boutique** (`hello@email.pluginboutique.com`): [Unsubscribe](<URL>) | [View Email](<URL>)

### Social & Notifications
- **LinkedIn** (`notifications-noreply@linkedin.com`): [Unsubscribe](<URL>) | [View Email](<URL>)

### Transactional (recommended keep)
- **Everyday Rewards** (`contacts@email.everyday.com.au`): [Unsubscribe](<URL>) | [View Email](<URL>)
```

Rules:
- Group senders by category
- Show sender name in bold, email in backticks
- If unsubscribe link exists: show `[Unsubscribe](URL)` as a clickable link
- If no unsubscribe link: write "No direct unsubscribe link" and explain what the email says (e.g. "visit Steam Support")
- Always show `[View Email](URL)` linking to the original email
- Skip empty categories
- Do not end with "Would you like me to..." options

## Important
- Always check memory first
- Always call get_email_body for every recurring sender
- Always call write_memory after scanning
- Only include senders with 2+ emails
- Include both links for every sender