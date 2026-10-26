# Promo website (prayertimes.asia)

The page people land on when you share the link: what the app does, how to try
it, what's coming next, and an invitation for masjids to partner. Plain HTML and
CSS, no build step. Edit `index.html` and push to main; it goes live in a couple
of minutes.

The Web workflow publishes this folder and the web app together on GitHub Pages:

| Address | What it shows |
|---|---|
| https://aarif86.github.io/PrayerTimesAsia/ | This promo page |
| https://aarif86.github.io/PrayerTimesAsia/app/ | The web app |

Once the domain is set up (below), the same two become **prayertimes.asia** and
**prayertimes.asia/app/**, and the old github.io links forward there by themselves.

`img/` holds the app screenshots (from the iPhone CI `screenshots` branch, resized
to WebP) and `share.png`, the picture WhatsApp, Telegram and Facebook show with the
link. `sw.js` clears out the old offline copy for anyone who opened the web app back
when it lived at the root. This README is not published.

## Putting it on prayertimes.asia (once you've bought it)

1. **Buy the domain** from any registrar (Cloudflare, Namecheap, Porkbun, Exabytes...).
2. **Point it at GitHub.** In the registrar's DNS settings for prayertimes.asia, add:

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | aarif86.github.io |

   Delete any other A or "parking" records for @ that the registrar put there. If the
   registrar uses Cloudflare's orange cloud (proxy), turn it off (grey cloud) for these.
3. **Tell GitHub.** Repository Settings → Pages → Custom domain: `prayertimes.asia` →
   Save. When the check turns green, tick **Enforce HTTPS** (the certificate can take
   up to an hour).
4. **Re-publish once.** Actions → Web → Run workflow. This moves the app to
   prayertimes.asia/app/.
5. *(Recommended)* **Lock the domain to your account**: your GitHub profile Settings →
   Pages → Add a domain, and add the TXT record it shows. This stops anyone else
   using the domain on GitHub.
6. **Make the email work.** The page's buttons send to `hello@prayertimes.asia`. Turn on
   email forwarding at the registrar (free at most, including Cloudflare Email Routing)
   to send it to your own inbox. To use another address instead, replace
   `hello@prayertimes.asia` everywhere in `index.html`.

DNS changes usually show up within an hour, sometimes up to a day.
