# Audio takedown procedure

What to do when anyone says they own, or speak for, a recording in the app.
We do not argue, and we do not ask them to prove it first. We remove, then talk.

## Steps

1. **Within 24 hours: reply.** Thank them, say we are removing it now, and ask
   how they would like to be contacted from here. Use the reply below.
2. **Remove it.**
   - Web app and website: delete the file from `web/src/assets/azan/` (and any
     page that links it) and deploy. This is live within the hour.
   - Android and iPhone: the file is inside the app, so a new build is needed.
     Delete it from `android/app/src/main/res/raw/` and
     `ios/PrayerTimesAsia/Resources/`, release Android, and send the iPhone
     build for review the same day. Alerts fall back to the next azan we hold,
     or the phone's own sound.
   - Credits: remove its line from Sources and credits on all three apps, and
     from the website Credits page.
3. **Log it** in `docs/AUDIO_LICENSES.csv`: set status to `Removed`, write the
   date of the complaint, a one-line summary, and save their email as a PDF
   (put the file name in "proof filename").
4. **Confirm removal** to them in writing, with the dates: removed from the web
   on [date], new app versions sent on [date].

Target: web gone within 48 hours of the complaint; app updates submitted within
48 hours (store review time is outside our control, say so honestly).

"Your own azan" files are not ours. They live only on the person's phone and we
never receive them, so there is nothing for us to take down. If someone writes
about one, explain that politely.

## Reply to send (step 1)

Subject: Your message about [recording name]

Assalamu'alaikum / Dear [name],

Thank you for writing to us. We are removing [recording name] from Prayer Times Asia now.
It will be gone from our website within 48 hours, and we will send updated iPhone and
Android apps without it within the same time. We will write again to confirm once that
is done.

We are sorry for any concern this caused. If you would be open to us using it with your
permission and the credit you prefer, we would be glad to talk, but that is entirely
your choice.

Kind regards,
Aarif Raziff
Prayer Times Asia
salam@prayertimes.asia
