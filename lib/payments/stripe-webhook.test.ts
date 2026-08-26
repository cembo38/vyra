import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeWebhookSignature } from "./stripe-webhook";

const SECRET = "whsec_test_secret";
const PAYLOAD = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });

function sign(payload: string, secret: string, timestamp: number) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeWebhookSignature", () => {
  it("accepteert een correct ondertekende, recente request", () => {
    const header = sign(PAYLOAD, SECRET, Math.floor(Date.now() / 1000));
    expect(verifyStripeWebhookSignature(PAYLOAD, header, SECRET)).toBe(true);
  });

  it("weigert een signature die met het verkeerde secret is gemaakt", () => {
    const header = sign(PAYLOAD, "whsec_ander_secret", Math.floor(Date.now() / 1000));
    expect(verifyStripeWebhookSignature(PAYLOAD, header, SECRET)).toBe(false);
  });

  it("weigert een signature bij een gewijzigde payload", () => {
    const header = sign(PAYLOAD, SECRET, Math.floor(Date.now() / 1000));
    expect(verifyStripeWebhookSignature(PAYLOAD + "x", header, SECRET)).toBe(false);
  });

  it("weigert een te oude timestamp (replay-bescherming)", () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    const header = sign(PAYLOAD, SECRET, tenMinutesAgo);
    expect(verifyStripeWebhookSignature(PAYLOAD, header, SECRET)).toBe(false);
  });

  it("weigert een ontbrekende header", () => {
    expect(verifyStripeWebhookSignature(PAYLOAD, null, SECRET)).toBe(false);
    expect(verifyStripeWebhookSignature(PAYLOAD, undefined, SECRET)).toBe(false);
  });

  it("weigert een misvormde header zonder t= of v1=", () => {
    expect(verifyStripeWebhookSignature(PAYLOAD, "onzin-header", SECRET)).toBe(false);
    expect(verifyStripeWebhookSignature(PAYLOAD, "t=123", SECRET)).toBe(false);
  });

  it("weigert wanneer er geen secret is geconfigureerd", () => {
    const header = sign(PAYLOAD, SECRET, Math.floor(Date.now() / 1000));
    expect(verifyStripeWebhookSignature(PAYLOAD, header, "")).toBe(false);
  });
});
