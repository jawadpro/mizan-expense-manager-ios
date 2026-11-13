# The universal Mizan Shortcut

Every customer installs the **same** Shortcut. It contains no address, token or personal detail, so it can be
shared publicly from iCloud. It learns which Mizan account to use when the customer pairs it, using a short code
from **SMS setup › Connected devices** (or the iPhone step of the setup guide).

Apple doesn't let anyone create a Shortcut file outside the Shortcuts app (unsigned `.shortcut` files can't be
imported), so whoever runs Mizan builds this Shortcut **once** on an iPhone, shares it from iCloud, and puts the
link in `MIZAN_SHORTCUT_URL`. After that, the setup guide shows a QR code and an **Add Shortcut** button for it.

## What it does

| How it runs | What it receives | What it does |
|---|---|---|
| From the **Connect this iPhone** button or the pairing QR page | Text `mizan-pair:<Mizan address>#<CODE>` | `POST <address>/api/devices/pair` with `{ "code", "name": <device name> }`, saves the returned token and address in `Shortcuts/Mizan/device.json` |
| By hand, not paired yet | nothing | Asks for the pairing code (address from the Import Question), then pairs as above |
| By hand, already paired | nothing | Sends a **test** alert (`"test": true`): Mizan checks the token and reads the alert, saves nothing, and the setup screen shows "Connection test received" |
| From the **Message automation** | the bank SMS | Sends it to `<address>/api/sms` with `Authorization: Bearer <token>`; if that fails (offline), saves it to `Shortcuts/Mizan/queue/` and sends the queue next time |

The device token is created by Mizan during pairing and is only ever sent from the server to the Shortcut in the
pairing response. It is never in a QR code, link, page, or the shared Shortcut. Mizan stores only its SHA-256 digest.

## Build it (about 15 minutes, once)

In the Shortcuts app on an iPhone (iOS 17 or later), create a Shortcut named **Mizan** (or set `MIZAN_SHORTCUT_NAME`
to the name you choose; the pairing button uses it). In the Shortcut's details, set **Receive** to *Text* and
*Messages*, and **If there's no input** to *Continue*.

1. **Text** action with your Mizan address, e.g. `https://mizan.example.com`. Then **Add to Import Questions**
   (in the action's menu) with the question "Mizan address" and that address as the default. Name the result `Default address`.
2. **Get File** from `Shortcuts/Mizan/device.json`, turn **Error If Not Found** off. **Get Dictionary from Input**. Name it `Device`.
3. **If** *Shortcut Input* **begins with** `mizan-pair:` (pairing from Mizan):
   - **Replace Text** `mizan-pair:` with nothing in *Shortcut Input*; **Split Text** by custom `#`.
   - **Get Item from List** first item → `Address`; last item → `Code`.
   - **Get Contents of URL** `Address/api/devices/pair`, Method **POST**, Request Body **JSON**: `code` = `Code`, `name` = *Device Name* (from **Get Device Details**).
   - **Get Dictionary Value** `token` → `Token`. **Dictionary** with `address` = `Address`, `token` = `Token`.
   - **Save File** to `Shortcuts/Mizan/device.json`, **Overwrite If File Exists** on, **Ask Where to Save** off.
   - **Show Notification** "This iPhone is connected to Mizan." **Stop This Shortcut**.
4. **Otherwise, If** *Shortcut Input* **does not have any value** (run by hand):
   - **If** `Device` **does not have any value**: **Ask for Input** "Pairing code from Mizan" → `Code`, then the same
     pairing steps as 3 with `Address` = `Default address`.
   - **Otherwise**: **Get Contents of URL** `Device.address/api/sms`, POST, header `Authorization` = `Bearer Device.token`,
     JSON `sender` = `MIZAN-TEST`, `text` = `PKR 1.00 debited from A/C ****0000 at MIZAN TEST`, `receivedAt` =
     *Current Date* formatted **ISO 8601** (include time), `test` = **true** (Boolean). **Show Result** with the
     `message` value.
5. **Otherwise** (a bank SMS from the automation):
   - **Get Details of Messages**: *Sender* → `Sender`, *Content* → `Body`. **Format Date** *Current Date* as ISO 8601 → `ReceivedAt`.
   - **Dictionary** `sender` = `Sender`, `text` = `Body`, `receivedAt` = `ReceivedAt` → `Alert`.
   - **Get Network Details** (Wi-Fi network name / cellular). **If** there is no network: **Save File** `Alert` to
     `Shortcuts/Mizan/queue/` with a timestamped name, **Stop This Shortcut**.
   - **Get Contents of URL** `Device.address/api/sms`, POST, `Authorization: Bearer Device.token`, Request Body *File* = `Alert` as JSON.
   - **Get Contents of Folder** `Shortcuts/Mizan/queue`; **Repeat with Each**: send it the same way, then **Delete Files**
     (turn on Settings › Apps › Shortcuts › Advanced › **Allow Deleting Without Confirmation** once).
   - If the response contains "isn't connected to Mizan any more", **Show Notification** "Pair this iPhone again in Mizan".
6. **Share** the Shortcut › **Copy iCloud Link**, and set `MIZAN_SHORTCUT_URL` to it (on Vercel: Project ›
   Settings › Environment Variables, then redeploy; with Docker: in `.env`, then `docker compose up -d`).

Mizan ignores a resend of the same alert (offline queue, retries, a second automation), so the queue can be
sent again safely.

## What the customer does

1. Scan the QR code in the setup guide (or tap **Add the Mizan Shortcut** on the iPhone) and tap **Add Shortcut**.
   There's nothing to type: the Import Question already has the address.
2. Pair: scan the pairing QR code with the Camera and tap **Connect this iPhone** (or, on the iPhone itself, tap the
   button in Mizan; or run the Shortcut and type the 8-character code).
3. Create the Message automation (Shortcuts › Automation › + › Message › Sender = the bank › Run Immediately ›
   the Mizan Shortcut). iOS requires the person to do this; no app or link can switch it on.
4. Run the Shortcut once by hand: Mizan shows **Connection test received**. The first real bank SMS turns the last
   check green.

## What can only be checked on a real iPhone

The server side can be checked with `curl` (pair with a code, then send an alert with `"test": true`).
These need a physical iPhone:

- importing the shared Shortcut from its iCloud link and the Import Question;
- the `shortcuts://run-shortcut` button and the QR pairing page opening the installed Shortcut;
- the Message automation firing for the bank's sender while the iPhone is locked;
- the offline queue (airplane mode, then back online);
- iOS permission prompts ("Allow Mizan to connect to …", "Always Allow").

## Notes and limits

- The token lives in a file in the Shortcuts folder of the customer's iCloud Drive. Anyone with access to that
  iCloud Drive could read it; that's why each iPhone has its own token that the customer can remove at any time in
  **Connected devices** (it stops working at once) and **Reconnect** to replace it.
- When an iPhone reaches Mizan over the internet, Mizan must be served over HTTPS. Set `APP_URL` if the address
  people use differs from the one requests arrive on.
- The older Expense Manager Shortcut (address and the account's SMS token pasted by hand) keeps working; SMS setup
  shows those values under "Using the older Expense Manager Shortcut".
