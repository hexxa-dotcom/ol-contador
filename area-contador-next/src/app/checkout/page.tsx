import { Suspense } from "react";
import { CheckoutClient } from "./checkout-client";

export const metadata = { title: "Finalizar contratação — Olá, Contador", robots: "noindex" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutClient />
    </Suspense>
  );
}
