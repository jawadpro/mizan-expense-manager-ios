import { headers } from "next/headers";
import ShortcutSteps from "@/components/ShortcutSteps";
import SmsToken from "@/components/SmsToken";
import ConnectedDevices from "@/components/ConnectedDevices";
import { ProOnly } from "@/components/plan";
import "../../setup.css";

export const dynamic = "force-dynamic";

export default async function SmsSetupPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-app.vercel.app";
  const endpoint = `https://${host}/api/sms`;
  return (
    <ProOnly feature="sms" title="SMS setup">
      <div className="page-head">
        <div>
          <h1>SMS setup</h1>
          <p className="muted">Your iPhone forwards bank alerts to Mizan with the Mizan Shortcut. Add each bank and its senders in Settings, under Bank messages.</p>
        </div>
      </div>
      <div className="grid" style={{ gap: 16, maxWidth: 820 }}>
        <div className="card">
          <h2>Connected devices</h2>
          <p className="small muted">Each iPhone pairs with a one-time code and gets its own key, so there&apos;s no address or token to type. You can remove an iPhone at any time.</p>
          <ConnectedDevices />
        </div>
        <details className="card">
          <summary>Using the older Expense Manager Shortcut (paste the address and token yourself)</summary>
          <h3 style={{ marginTop: 14 }}>Your Mizan URL</h3>
          <pre>{endpoint}</pre>
          <h3 style={{ marginTop: 14 }}>SMS token</h3>
          <SmsToken />
          <div style={{ marginTop: 14 }}><ShortcutSteps endpoint={endpoint} /></div>
        </details>
        <div className="alert warn">
          <span>Unfamiliar or ambiguous messages land in the Review inbox instead of being guessed. Use Test a message in Settings to check how a bank&apos;s alerts are read.</span>
        </div>
        <details className="card">
          <summary>For developers: what the Shortcut sends</summary>
          <pre>{`POST ${endpoint}\nAuthorization: Bearer <this iPhone's device token, from pairing>\nContent-Type: application/json\n\n` + JSON.stringify({ sender: "MYBANK", text: "PKR 2,450.00 debited from A/C ****1234 on 15-Oct-2026 14:22 at FOODPANDA. Avl Bal PKR 85,301.17", receivedAt: "2026-10-15T14:22:31+05:00" }, null, 2)}</pre>
        </details>
      </div>
    </ProOnly>
  );
}
