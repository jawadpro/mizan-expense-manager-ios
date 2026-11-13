import { ToastProvider } from "@/components/Toast";
import ConnectPhone from "./ConnectPhone";
import "../setup.css";

export const metadata = { title: "Connect your iPhone", robots: { index: false, follow: false } };

/** Opened on the iPhone by scanning the QR code in SMS setup. Needs no sign-in: the token comes in the #fragment. */
export default function ConnectPage() {
  return (
    <ToastProvider>
      <ConnectPhone />
    </ToastProvider>
  );
}
