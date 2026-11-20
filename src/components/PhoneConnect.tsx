"use client";
import { useEffect, useState } from "react";
import ConnectedDevices from "./ConnectedDevices";
import { isAndroid, type PhoneKind } from "./paired-devices";

const KEY = "mizan.phoneKind";

/**
 * Connect phone: iPhone or Android, side by side. Opens on Android when the page is open on an Android phone, and
 * otherwise on whichever was picked last.
 */
export default function PhoneConnect() {
  const [kind, setKind] = useState<PhoneKind>("shortcut");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    if (isAndroid()) setKind("android");
    else if (saved === "android" || saved === "shortcut") setKind(saved);
  }, []);
  function pick(k: PhoneKind) {
    setKind(k);
    try {
      localStorage.setItem(KEY, k);
    } catch {}
  }
  return (
    <>
      <div className="phone-tabs" role="tablist" aria-label="Phone">
        <button type="button" role="tab" aria-selected={kind === "shortcut"} onClick={() => pick("shortcut")}>iPhone</button>
        <button type="button" role="tab" aria-selected={kind === "android"} onClick={() => pick("android")}>Android</button>
      </div>
      <div role="tabpanel">
        <ConnectedDevices key={kind} kind={kind} />
      </div>
    </>
  );
}
