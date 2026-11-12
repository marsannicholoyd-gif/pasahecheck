# PasaheCheck — Free GPS jeepney fare website (starter)

A mobile-friendly website prototype. It currently supports **traditional jeepney** and **modern jeepney** fare estimates; buses have different rate tables and are not included yet.

**Contains:**
- Select traditional / modern jeepney.
- Enter route code for reference only (no actual route matching yet).
- Test a trip with the demo distance slider.
- Start and end live browser GPS tracking on a phone.
- Preview your approximate trip path on an OpenStreetMap map.
- Apply the standard 20% student / PWD / senior discount.
- Compare estimated fare with the amount charged.
- No backend, no logins, no uploading of location data.

## Files

- `index.html`: the page's structure.
- `styles.css`: responsive design.
- `fare-engine.js`: fare formulas; suitable for testing independently.
- `app.js`: website interactivity, GPS tracking and map.
- `tests.js`: quick fare-engine tests with Node.js (optional).

## How to run for FREE

1. Install [Visual Studio Code](https://code.visualstudio.com/) (optional; any text editor works).
2. Extract the ZIP and open its `pasahecheck-starter` folder.
3. For **demo mode**, open `index.html` with Chrome or Edge. Internet is needed for the CDN-hosted map library and map tiles.
4. For **GPS on your computer**, serve the folder on localhost:

   ```bash
   python -m http.server 8000
   ```

   Open `http://localhost:8000` (or use the free Live Server extension in VS Code). GPS also requires a suitable device/location provider and browser permission.

5. For **GPS on your phone**, publish the site over HTTPS. Easy free option: create a public GitHub repository, upload the project files to the repository ROOT, then go to **Settings → Pages → Deploy from a branch → main → / (root)**. Open the resulting HTTPS URL on your phone and allow location permission. GitHub Pages supports static HTML, CSS and JS websites from public repositories on the Free plan.

   Merely opening an HTML file or accessing a local PC's HTTP address from your phone may not meet browser secure-context requirements; HTTPS or localhost is the reliable route.

## Prototype fare rules

Rates used from fare adjustments effective September 28, 2026:

| Jeepney | First four kilometers | Succeeding kilometer |
|---------|------------------------|----------------------|
| Traditional | ₱14.00 | ₱2.00/km |
| Modern | ₱17.00 | ₱2.40/km |

Estimated fare = (base + max(0, distance - 4) × rate) × (0.8 if eligible discount), rounded to the nearest ₱0.25.

**IMPORTANT:** This starter prorates partial succeeding kilometers and measures approximate GPS path distance, not the legally chargeable distance along an authorized route. The precise official LTFRB matrix, fractional-kilometer policies, terminal distances, and any route-specific conditions must be integrated and verified before declaring a fare illegal. Even if the app shows a difference, it is not proof of overcharging. Rates can change; update the rate config as needed.

References:
- [Philippine Information Agency, Sept 28, 2026 – updated PUV fare matrix must be displayed](https://pia.gov.ph/news/ltfrb-reminds-puv-operators-drivers-to-display-updated-fare-matrix/)
- [SunStar Cebu, Sept 27, 2026 – updated jeepney fare rates](https://www.sunstar.com.ph/amp/story/cebu/higher-puv-fares-take-effect-monday-sept-28)
- [LTFRB FOI example – fares rounded to nearest ₱0.25](https://www.foi.gov.ph/agencies/ltfrb/how-fare-matrix-is-made/)

## GPS limitations

- The browser must grant precise location permission; GPS is easiest outdoors.
- Keep the website open, visible, and the phone awake. Browsers commonly stop/suspend updates in the background and with locked screens.
- Very inaccurate coordinates (>50m), jumps >35m/s and small movements (<12m) are excluded to limit false readings. This is a simple filter, NOT road map matching. Turning, sparse fixes, and urban GPS errors can under- or over-estimate the distance.
- No GPS coordinates are transmitted by this site's JavaScript to an app backend. Loading a map from OpenStreetMap does involve requests to external map tile services that can see normal request metadata such as IP address. No trip history is saved after closing or refreshing the tab.
- For production, consult OpenStreetMap tile usage policy and switch to a properly provisioned tile provider if usage grows.

## Next development steps

1. Add verified LTFRB route identifiers, direction and geometry for Cebu routes.
2. Do map matching to the authorized route (not raw GPS jumps) and compute official chargeable boarding-to-exit kilometers.
3. Use the downloadable LTFRB route/fare table for each category and distance bracket, with accurate rounding.
4. Implement safe handling of lost GPS and offline map tiles, including usability tests.
5. Add official separate bus fare rules (city vs provincial, aircon vs ordinary) if you want bus support.

**No warranties:** research/educational prototype; not an official LTFRB or LTO service.
