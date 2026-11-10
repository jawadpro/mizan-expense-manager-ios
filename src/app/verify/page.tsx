import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";
import VerifyEmail from "./VerifyEmail";
import "../extra.css";

export const metadata = { title: "Confirm your email" };

export default function VerifyPage() {
  return (
    <AuthCard title="Confirm your email">
      <Suspense><VerifyEmail /></Suspense>
    </AuthCard>
  );
}
