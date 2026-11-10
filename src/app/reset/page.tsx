import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";
import ResetForm from "./ResetForm";
import "../extra.css";

export const metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <AuthCard title="Choose a new password" subtitle="You'll be signed out on every other device.">
      <Suspense><ResetForm /></Suspense>
    </AuthCard>
  );
}
