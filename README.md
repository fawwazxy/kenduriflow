# KenduriFlow

Smart parking for every township celebration. Built for the Sime Darby Property University Hackathon 2026 (People track).

Home events such as weddings, kenduri, tahlil and open houses bring 50 to 200 cars into streets built for each house's own one or two cars. KenduriFlow predicts how many cars will come and when, plans where each one parks, guides guests to a free space with a link, and keeps the emergency lane and neighbours' gates clear.

## For judges: start here

```
npm install
npm start
```

Open http://localhost:3000. There is **no sign-in**: choose who you are.

| Role | Who | What you see |
|---|---|---|
| Township team | Nurul Huda | Every event, clashes, neighbour reports, learning from real counts, planning data, people |
| Guard | Razak Ali | Gate screen: count cars, scan guests' entry and exit QR, emergency lane, reports |
| Resident | Rohana Ismail, No. 12 | Plans her 500-guest wedding, shares the invitation, her street, report a blocked gate |
| Guest | No account | The invitation link: where to park, hold a space, entry and exit QR pass |

Switch role any time with the **DEMO · role** button next to the logo. The role is shared by every tab in one browser; to show two roles side by side, open the second one on a phone or in a private window.

## Demo or real system

| | Demo | Real system |
|---|---|---|
| Start | `npm start` (or `npm run demo`) | `npm run live` |
| Data | `data/demo.json` (sample events) | `data/db.json`, daily copies in `data/backups` |
| People | Choose a role, no sign-in | Added by the township team; each signs in |
| Sign-in | None | Random 6-digit code by SMS, valid 5 minutes |
| Clock | "Play the event" fast-forwards | Real time in the township (Asia/Kuala_Lumpur) |
| Dashboard figures | Sample figures | From real events |

The two never share data. Running `node server.js` with no flag (for example in Docker) is the real system.

### First start of the real system

1. `npm run live`. The terminal prints a **setup key**.
2. Open the address and you go to **Set up**. Enter the key, your name and mobile number. This creates the first township team account. The key works once.
3. On **People**, add residents (name, mobile, house) and guards, one at a time or many at once.
4. Each person signs in with their own mobile number and the 6-digit code sent to them.

### Sending sign-in codes by SMS

Until SMS is set up, codes are printed in the server terminal and saved in `data/sms-outbox.log`, so you can set up and test. To send real SMS through Twilio, set these before `npm start`:

```
$env:TWILIO_ACCOUNT_SID="AC..."; $env:TWILIO_AUTH_TOKEN="..."; $env:TWILIO_FROM="+1..."
```

### Putting it online (https)

Phones only install the full app, and browsers only keep sign-ins secure, over **https**. Use a host that gives https (Render, Railway, Fly.io) or your own server behind nginx/Caddy:

- `Dockerfile` is included: `docker build -t kenduriflow .` then `docker run -p 3000:3000 -v kenduriflow-data:/app/data kenduriflow`.
- Keep `/app/data` on a volume: it holds events, people and backups.
- Behind an https proxy, set `TRUST_PROXY=1` (the Dockerfile does) so sign-in cookies are marked secure.
- `/healthz` answers `{ ok: true }` for uptime checks.

### Security in the real system

- Sign-in codes and sessions are stored only as hashes. Codes expire after 5 minutes and allow 5 wrong tries; a number can ask for 3 codes per 10 minutes.
- The sign-in page answers the same way for unknown numbers, so it cannot be used to find out who lives here.
- Every action is checked on the server against the person's role and house.
- Changes must be sent as JSON (blocks other websites from acting for a signed-in person), and strict security headers block framing and outside scripts.
- Event details need sign-in. Guests see only their invitation page, without neighbours' reports or the guard's log. Guest-facing ids and links are random.
- Removing a person signs them out at once; their past records stay.

### What is still needed for a full rollout

- The real precinct map and parking bays (the layout in `src/seed.js` is the sample Elmina precinct).
- An SMS account (Twilio or a Malaysian SMS gateway).
- Push notifications to phones (needs https; today neighbours see notices when they open the app).
- A database server (PostgreSQL) when running many townships from one server.

## What is inside

| Page | Address | Who uses it |
|---|---|---|
| Home | `/` | Start here. Links to every role and a QR code for your phone. |
| Host | `/host` | Register an event. Live estimate while typing. |
| Host event | `/host/:id` | Prediction, parking plan, live map, guest link and QR, neighbours, timeline. |
| Guest | `/e/:code` | Phone page from the invitation link, in English or Bahasa Melayu. Before the day: "how many people, how many cars". On the day: where to park, spaces left, walking route, hold a space while on the way, "Someone is already parked here", "I've parked", "I'm leaving". |
| Guard | `/guard/:id` | Count cars in and out, recount a zone, elderly / OKU button, guests on the way, next free space, emergency lane alerts, neighbour reports, "Play the event", "End event and save counts". |
| Neighbour | `/neighbour` | In English or Bahasa Melayu. New-event notices, keep the kerb opposite your gate clear, share your driveway for points, report a problem in one tap. |
| Township team | `/admin` | All events, lane alerts, reports, clashes, learning from real counts, monthly trends, planning ideas. |

Every page is designed for a phone first. On a phone the role links move to a tab bar at the bottom of the screen. The guest and neighbour pages have an EN / BM switch in the top bar; the host, guard and township pages are in English.

Everything updates live on every open screen through Socket.IO. Open the guest page on your phone and press **Play the event** on the laptop to see it.

## Sign in and roles

KenduriFlow works like an app: each person signs in with their mobile number and a one-time code, and sees the screens for their role.

| Role | Signs in? | Home | Can do |
|---|---|---|---|
| Resident | Yes | `/neighbour` | Host events at their own house, share their driveway, report problems, keep their gate clear |
| Guard | Yes | `/guard` | Count cars, recount zones, emergency lane, sort reports, end events |
| Township team | Yes | `/admin` | Everything, for every house and event |
| Guest | **No** | `/e/:code` | The invitation link is all a guest needs |

In the **demo** there is no sign-in: the home screen asks who you are and uses these demo accounts.

| Demo account | Role |
|---|---|
| Nurul Huda | Township team |
| Razak Ali | Guard |
| Rohana Ismail | Resident, hosting the wedding at No. 12 |
| (none) | Guest: opens the wedding's invitation link |

The server checks every action against the role, not just the screens.

## Install it like an app

KenduriFlow is a Progressive Web App: an app icon, full screen, and the guest page keeps the last plan when the signal drops.

- **On this laptop** (Chrome or Edge at http://localhost:3000): click the install icon in the address bar, or **Account → Install KenduriFlow**.
- **iPhone**: Safari → Share → **Add to Home Screen**.
- **Android**: Chrome menu ⋮ → **Add to Home screen**.

Full install with offline support needs a secure address (https or localhost). Over the Wi-Fi address (http://192.168…), phones add a home-screen shortcut instead. To get the full install on phones, put the app on an https host or tunnel.

## Gate passes and the guard's camera

Every guest gets a green **entry QR** when they open the invitation link, and a blue **exit QR** once the guard has scanned them in. Each QR has a 6-letter code under it in case the camera fails.

The guard scans with the camera built into the app: **Scan** on the Gate screen. Phones only allow the camera on a secure address, so the server also runs one on this computer:

```
Guard phones (QR camera):  https://192.168.x.x:3443
```

1. On the guard's phone, open that address (the Gate screen's scan button links to it).
2. The first time, the phone warns that the connection is not private, because the certificate is made by KenduriFlow itself. Android: **Advanced → Proceed**. iPhone: **Show details → visit this website**.
3. Choose **Guard** (demo) or sign in (real system) once on that address. From then on, **Scan** opens the camera straight away and keeps scanning car after car. There's a torch button for dark gates.

It reads QR codes on every phone: with the phone's built-in reader where there is one (Android Chrome), and with jsQR otherwise (iPhone). When the app is online with a real https address, the warning step disappears. The certificate is saved in `data/certs`; set `HTTPS_PORT` to use another port, or `HTTPS_PORT=0` to switch the secure address off.

## Run it (Windows)

You need **Node.js 18 or newer**. Check in a terminal:

```
node -v
```

If it says "not recognized", install the LTS version from https://nodejs.org and reopen VS Code.

1. Open this folder in VS Code (**File > Open Folder…**, choose `KenduriFlow`).
2. Open a terminal: **Terminal > New Terminal**.
3. Install the packages (first time only):
   ```
   npm install
   ```
4. Start the demo (no sign-in, choose a role):
   ```
   npm start
   ```
   Or the real system with sign-in:
   ```
   npm run live
   ```
   `npm run dev` and `npm run dev:live` do the same but restart by themselves every time you save a file.
5. Open http://localhost:3000 in your browser.

You can also open `server.js` and press **F5**, then choose **Node.js**, to run it with the debugger.

To stop the server, click in the terminal and press **Ctrl+C**.

## Phone testing

1. Connect the phone to the **same Wi-Fi** as the laptop.
2. When the server starts, the terminal prints a line like `On your phone: http://192.168.1.23:3000`. Type that into the phone's browser, or scan the QR code on the home page or on an event page.
3. If Windows shows a firewall prompt for Node.js, tick **Private networks** and click **Allow**.

If the phone still cannot open it:

- Check the laptop's Wi-Fi is set to **Private** (Settings > Network & internet > Wi-Fi > your network > Network profile type > Private).
- Or allow Node.js manually: Windows Security > Firewall & network protection > Allow an app through firewall > Change settings > tick **Node.js JavaScript Runtime** for Private.
- University and hotel Wi-Fi often block devices from talking to each other. Use your phone's hotspot instead: connect the laptop to the hotspot, then open the address on the phone.

## Demo script (about 2 minutes)

Start with `npm start` and choose a role on the home screen; switch with the **DEMO · role** button next to the logo.

1. **Host:** choose **Resident** (Rohana Ismail), go to **My events** and open `Majlis Aisyah & Hakim`. 500 guests means 167 cars, but only about 70 at the same time. The plan fills the kerb, shared driveways, the next street, the surau, then the mall with a shuttle.
2. Point out the **clash**: an aqiqah at No. 20 on the same street. The kerb is split by distance to each house.
3. Scan the **guest QR** with your phone. Switch to **BM**. Tap **hold it for 10 min**: no other guest is sent there. Tap **Someone is already parked here**: that space is marked full and the next one is held.
   Then open **Walimatul urus Farah & Danial**: 42 guest replies raised the estimate from 117 to 134 cars.
4. **Guard:** press **Play the event**. Zones fill on the map, and the guest page on the phone switches to the next zone by itself.
5. **Neighbour:** choose No. 14, tap **My gate is blocked** or **Cars in the emergency lane**. The guard page turns red and buzzes instantly.
6. **Guard:** press **Lane clear**, then **End event and save counts**.
7. **Township team:** every event, lane alert, clash and rubbish pickup, what the counts taught us, plus data for planning visitor bays and halls.

Use **Reset demo data** on the Township team page (or `npm run reset`) to start again.

## How it works

**Prediction** (`src/predict.js`)

1. Total cars = guests ÷ people per car (wedding 3.0, tahlil 1.6, open house 3.5 …), tuned by past counts and this event's guest replies (see Learning).
2. Arrivals are spread over the event in 5-minute steps using a bell curve centred on the usual busy time for that event type.
3. Cars at the house at any moment = cars that arrived within their usual stay (about 45 to 120 minutes).
4. Spaces to plan = the busiest moment + 10% buffer.

The numbers per event type are in `src/config.js`. They are starting assumptions. Back them up with a short survey ("How many people came in your car to the last kenduri?") and tune them.

**Allocation** (`src/allocate.js`)

- Only the park side of each street is used. The house side stays clear as the emergency lane.
- Order: own street kerb → shared driveways → next street kerb → surau car park → mall car park with shuttle.
- The kerb spaces nearest the house are kept for elderly and OKU guests.
- A neighbour can ask to keep the kerb opposite their gate clear (to drive out at any time). Those bays are left out of every plan.
- When two events overlap on one street, each kerb space goes to the host whose house is nearer.
- Shared car parks go to the event registered first.
- The surau car park is not used during Friday prayers.

**Live** (`src/simulator.js`, `server.js`)

- Every car is recorded with its exact space. The guest link and guard screen always show the next free space.
- A guest on the way can hold the suggested space for 10 minutes (`HOLD_MIN`). Held spaces are skipped for everyone else, so two guests are never sent to the same space. Holds run out by themselves.
- If a guest finds their space already taken (someone parked without the link), "Someone is already parked here" marks it full and shows, or holds, the next one.
- The guard counts cars in with + and out with −. With no camera, "−" frees the car that has been parked longest. When walking past a zone, "Recount" sets the real number.
- The emergency lane counts as blocked when the guard taps "Car in lane" or a neighbour reports cars on the house side. Guard, host, guest and map all show it until the guard taps "Lane clear".
- Changes are pushed to every open page with Socket.IO.

**Learning** (`src/learn.js`)

- "End event and save counts" on the guard page saves the cars counted, the busiest moment, and the prediction.
- The next estimate for that event type blends the starting people-per-car with the counted values. The starting value counts as 4 events (`LEARN_WEIGHT` in `src/config.js`).
- Simulated events and counts under half or over double the prediction (usually a guard who stopped counting) are shown on the Township page but not used.
- An event never tunes its own estimate, so its plan stays stable.
- Guest replies: after 5 replies, the replies' people-per-car gradually takes over (weight = replies ÷ (replies + 15)). The guest number never drops below the people who already replied.
- The demo data includes 10 past counted events, so the Township page shows learning from the start. The three past weddings average exactly 3.0 people per car, so the wedding estimate stays 167 cars.

## Project structure

```
server.js            Express server, API routes, Socket.IO
src/
  config.js          Settings and event-type assumptions
  predict.js         Prediction model
  allocate.js        Parking plan and next free space
  learn.js           Learning from real counts and guest replies
  auth.js            Sign-in by phone and code, sessions, role permissions
  actions.js         Create events, park cars, emergency lane, share driveways, reports
  simulator.js       "Play the event"
  views.js           Shapes data for each page
  store.js           Saves everything in data/db.json
  seed.js            Demo precinct, parking zones and sample events
public/
  *.html             One page per role
  js/                Page scripts (plain JavaScript modules, no build step)
  css/app.css        Styles
scripts/reset.js     Restores the demo data
```

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/me` | The signed-in account, or `null` |
| POST | `/api/auth/start` / `verify` | Sign in: `{ phone }`, then `{ phone, code }` |
| POST | `/api/auth/demo` / `logout` | One-tap demo account (`{ userId }`), sign out |
| GET | `/api/events` | List events with their estimates |
| POST | `/api/preview` | Estimate and plan without saving |
| POST | `/api/events` | Register an event |
| PUT | `/api/events/:id` | Change an event |
| POST | `/api/events/:id/cancel` | Cancel an event |
| GET | `/api/events/:id/state` | Everything for the event, guard and map pages |
| GET | `/api/e/:code` | Same, by guest link code |
| POST | `/api/events/:id/cars` | Park a car in the next free space (`{ vip, source }`) |
| POST | `/api/events/:id/cars/leave` | Guard "−": a car left |
| POST | `/api/events/:id/slots/:slotId/taken` | Guest: that space already has a car in it |
| POST | `/api/events/:id/holds` | Guest on the way holds the next free space (`{ vip }`) |
| GET | `/api/holds/:hid` | A hold and the seconds left |
| POST | `/api/holds/:hid/cancel` / `taken` | Release a hold, or mark the held space full and hold the next |
| POST | `/api/events/:id/rsvp` | Guest reply (`{ id?, people, cars }`) |
| POST | `/api/events/:id/zones/:zoneId/recount` | Guard sets the real number of cars in a zone (`{ count }`) |
| POST | `/api/frontage` | Neighbour keeps the kerb opposite their gate clear (`{ house, on }`) |
| POST | `/api/events/:id/lane/block` / `clear` | Guard records or clears a car in the emergency lane |
| POST | `/api/events/:id/finish` | End the event and save the counts for learning |
| POST | `/api/events/:id/zones/:zoneId/add` / `remove` | Guard corrects a zone count |
| POST | `/api/cars/:carId/leave` | Guest leaves |
| POST | `/api/events/:id/sim/start` / `pause` / `reset` | Play the event |
| GET | `/api/houses/:no` | Neighbour feed for a house |
| POST | `/api/shares` | Share a driveway (`{ eventId, house, cars, on }`) |
| POST | `/api/reports` | Report a problem |
| POST | `/api/reports/:id/resolve` | Guard marks a report as sorted |
| GET | `/api/admin/overview` | Township dashboard data |
| POST | `/api/admin/reset` | Restore the demo data |

## Ideas for next steps

- Real SMS codes, or sign-in through the township resident app account.
- Bahasa Melayu on the host, guard and township pages (guest, neighbour, sign-in and account pages already have it).
- Real WhatsApp messages through the WhatsApp Business API.
- Plate recognition at the guardhouse camera instead of tapping +1.
- Learn arrival patterns and stay times from real counts, not only people per car.
- Move `data/db.json` to MongoDB or PostgreSQL for many townships.

Street names, people, events and the monthly numbers on the Township team page are sample data for the prototype.
