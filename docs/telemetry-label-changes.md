# Store label changes for the new usage counts

For the owner to apply when the release that carries this change goes to the stores.
Nothing here is live until then. The old labels stay right for the apps already in the stores.

## What is new

Once a day, inside the existing daily note (App.daySummary), the app also sends short words and yes or no about how it is set up:
look, light or dark, language (or auto), how many prayers have alerts, azan voice and length, own azan yes or no,
how many alarms, big text, prayer tracker, My masjid, how many widgets. It also says whether Qibla compass, facing the Qibla and
the Falak tools (shadow camera, level, AR) were used that day. A masjid TV also sends one note when it is paired with a phone.
Nothing typed, no file, no name, no place beyond city and country (already declared).

## Apple App Privacy (App Store Connect, App Privacy)

Everything stays **Data Not Linked to You**, **not used for tracking**, purpose **Analytics**.

| Type | Today | Change |
|---|---|---|
| Usage Data, Product Interaction | declared | keep |
| Usage Data, Advertising Data | declared | keep (Barakah Picks cards) |
| Usage Data, **Other Usage Data** | not declared | **add**, Analytics, not linked, no tracking (the setup words and tool use above) |
| Location, Coarse Location | declared | keep |
| Identifiers, Device ID | check | keep as it is now (the random number made on the phone; if it is not declared yet, add it, not linked, no tracking) |

## Google Play Data safety

| Section | Data type | Change |
|---|---|---|
| Location | Approximate location | keep |
| App activity | App interactions | keep, and widen the description to say it includes which features were used |
| App activity | **Other actions** | **add**, collected, not shared, optional (users can turn it off in Settings), Analytics (the setup words) |
| Device or other IDs | Device or other IDs | keep |

If Play's wording makes "App interactions" enough for setup choices, adding "Other actions" is still safe (over-declaring is allowed, under-declaring is not).

## Website

The privacy page (site/privacy.html) is already updated in this change and goes live with the next website publish.
