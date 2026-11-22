# Branded emails and forms (standing rule)

Every email Prayer Times Asia sends, and every new form or process that sends one, uses the branded look below. No plain text emails. This is how a polished team looks, so please follow it every time, including the overnight worker.

## The look

- Header in navy `#151A45` with the app icon (`https://prayertimes.asia/img/icon-192.png`, rounded), the name "Prayer Times Asia" and the line "Asia first. Now worldwide." in gold `#E2B65A`.
- A thin gold bar under the header.
- White body, dark text `#26282E`, headings navy, a soft sand box `#F4F1EC` with a gold left edge for the one gentle reminder.
- A navy pill button for the one thing we want them to do (for example Visit prayertimes.asia).
- Navy footer with the line "Built fisabilillah in Singapore" (no names) and the `salam@prayertimes.asia` address.
- Plain layman words. No colons or dashes in the copy. No duas or adhkar. One line saying to follow the local religious authority when the email touches prayer times.
- Greeting must work with no first name. Write "Assalamualaikum, thank you." or "Assalamualaikum and thank you." Never use a name merge field in the greeting.
- Inline styles only, tables for everything (no padding or background on a `p` or `a`, because the GHL editor and some mail apps drop them), max width 560px. Put padding on `td` cells. The sand box and the button are one cell tables so they keep their spacing. Always check the result on a phone before publishing.
- Internal alerts to salam@ use the same header and layout (smaller icon, a clear title such as "New note received", then the answers).

## Reusable thank-you template

Replace the heading, the two or three body sentences and the button. Keep everything else.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F1EC" style="background:#F4F1EC;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;"><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;font-family:-apple-system,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center" bgcolor="#151A45" style="background:#151A45;border-radius:20px 20px 0 0;padding:36px 24px 28px;"><img src="https://prayertimes.asia/img/icon-192.png" width="76" height="76" alt="Prayer Times Asia" style="display:block;margin:0 auto 14px;border:0;border-radius:18px;"><div style="color:#FFFFFF;font-size:21px;font-weight:700;">Prayer Times Asia</div><div style="color:#E2B65A;font-size:13px;margin-top:6px;">Asia first. Now worldwide.</div></td></tr><tr><td bgcolor="#E2B65A" height="4" style="background:#E2B65A;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr><tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;padding:32px 32px 8px;color:#26282E;font-size:16px;line-height:1.65;"><p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#151A45;">Assalamualaikum, thank you.</p><p style="margin:0 0 20px;">We received your note. Every note is read by a real person. If we need a little more detail, we will write back to you.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td bgcolor="#F4F1EC" style="background:#F4F1EC;border-left:4px solid #E2B65A;border-radius:10px;padding:16px 20px;color:#262B5E;font-size:15px;line-height:1.6;">For prayer times, please keep following your local religious authority and your masjid.</td></tr></table><p style="margin:24px 0 4px;">Jazakallahu khairan,</p><p style="margin:0 0 20px;font-weight:700;color:#151A45;">The Prayer Times Asia team</p></td></tr><tr><td align="center" bgcolor="#FFFFFF" style="background:#FFFFFF;padding:8px 32px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td align="center" bgcolor="#151A45" style="background:#151A45;border-radius:999px;padding:13px 28px;"><a href="https://prayertimes.asia/" style="color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;"><span style="color:#FFFFFF;">Visit prayertimes.asia</span></a></td></tr></table></td></tr><tr><td align="center" bgcolor="#151A45" style="background:#151A45;border-radius:0 0 20px 20px;padding:20px 24px;color:#A9B2D6;font-size:12px;line-height:1.7;">Built fisabilillah in Singapore<br>You are receiving this because you sent us a note. Write to us any time at <a href="mailto:salam@prayertimes.asia" style="color:#E2B65A;text-decoration:none;">salam@prayertimes.asia</a></td></tr></table></td></tr></table>
```

## How to build a new form and its emails (GoHighLevel)

Every form lives in GHL. No mailto links for anything people send us.

1. **Form.** Sites, Forms, duplicate "Prayer Times Asia | Notes and prayer rooms" (it already carries the look). Rename it "Prayer Times Asia | <Topic>". Add fields from Add Object Fields (the blue plus makes new custom fields). Email is required so we can thank them. Keep the Submit button last.
2. **On-screen thank-you.** Form Settings, On Submit, Message. Say plainly "Thank you, we received your <thing>", what happens next, and Jazakallahu khairan. No colons or dashes.
3. **Workflow.** Automation, Create workflow, Build using AI works well. Trigger Form Submitted for the form. Steps in order: Add tag (a clear name such as `notes-received`), Internal notification to `salam@prayertimes.asia` (branded alert), Email to the contact (branded thank-you). Subject starts with "Thank you". From name "Prayer Times Asia", from email `salam@prayertimes.asia`.
4. **Email body.** In the Email step choose Quick compose, press the `<>` source code button, select all, paste the template above, Save, Save action. Preview must show the icon, navy header and gold bar.
5. **Test.** Publish the workflow, submit the form once with the owner's own email, check the on-screen thank-you, the thank-you email and the salam@ alert.
6. **Site and apps.** Embed the form on a page on prayertimes.asia (copy `site/new-look.html`). The iPhone, Android and web apps open that page instead of composing an email.
7. **Record it.** Add the form id, tag and workflow to the project notes.

Emails that are not form replies (welcome, done, reminders) follow the same template with a different heading and body.
