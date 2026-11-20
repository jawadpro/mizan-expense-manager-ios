import Link from "next/link";
import PhoneConnect from "@/components/PhoneConnect";
import "../../setup.css";

export const dynamic = "force-dynamic";

export default function ConnectPhonePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Connect phone</h1>
          <p className="muted">Mizan reads your bank alerts as they arrive on your iPhone or Android phone. Scan one QR code with the phone to connect it.</p>
        </div>
      </div>
      <div className="cx-page">
        <div className="card cx-card">
          <PhoneConnect />
        </div>
        <div className="card cx-notes">
          <h3>Good to know</h3>
          <ul>
            <li>Add each bank and its SMS senders in <Link href="/app/settings">Settings</Link>, under Bank messages.</li>
            <li>Alerts Mizan can&apos;t read with confidence wait in the <Link href="/app/review">Review inbox</Link> instead of being guessed.</li>
            <li>No internet when an alert arrives? On iPhone the Shortcut keeps it: back online, open Mizan on your iPhone, tap <b>More</b>, then <b>Import queued messages</b>, or add the queued messages widget from <b>More › Widgets</b>. On Android the forwarder app retries by itself.</li>
            <li>Each phone has its own key. Remove a phone here and its key stops working at once.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
