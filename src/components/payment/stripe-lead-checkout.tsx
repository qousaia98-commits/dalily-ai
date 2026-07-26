"use client";

import { useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentAlert } from "@/components/payment/payment-alert";

type StripeLeadCheckoutProps = {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
  onPaid: () => void;
  onError?: (message: string) => void;
};

function CheckoutForm({
  amount,
  currency,
  onPaid,
  onError,
}: {
  amount: number;
  currency: string;
  onPaid: () => void;
  onError?: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useTranslations("stripeCheckout");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) {
      const msg = submitError.message ?? t("errorGeneric");
      setError(msg);
      onError?.(msg);
      setPending(false);
      return;
    }
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url:
          typeof window !== "undefined"
            ? window.location.href
            : "http://localhost:3000",
      },
    });
    if (result.error) {
      const msg = result.error.message ?? t("errorGeneric");
      setError(msg);
      onError?.(msg);
      setPending(false);
      return;
    }
    setPending(false);
    onPaid();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("leadAmount", { amount, currency })}
      </p>
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />
      {error ? (
        <PaymentAlert variant="error" title={t("errorTitle")} body={error} />
      ) : null}
      <Button
        type="button"
        className="h-12 w-full rounded-2xl"
        disabled={!stripe || pending}
        onClick={() => void submit()}
      >
        {pending ? (
          <>
            <Loader2 className="me-2 size-4 animate-spin" />
            {t("processing")}
          </>
        ) : (
          t("payCta")
        )}
      </Button>
      <p className="text-xs text-muted-foreground">{t("secureHint")}</p>
    </div>
  );
}

export function StripeLeadCheckout(props: StripeLeadCheckoutProps) {
  const stripePromise = useMemo(
    () => loadStripe(props.publishableKey) as Promise<Stripe | null>,
    [props.publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#0B1526",
            borderRadius: "12px",
          },
        },
      }}
    >
      <CheckoutForm
        amount={props.amount}
        currency={props.currency}
        onPaid={props.onPaid}
        onError={props.onError}
      />
    </Elements>
  );
}
