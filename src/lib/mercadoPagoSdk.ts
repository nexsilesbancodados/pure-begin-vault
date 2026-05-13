declare global {
  interface Window {
    MercadoPago?: any;
  }
}

let mercadoPagoSdkPromise: Promise<void> | null = null;

export function ensureMercadoPagoSdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();

  if (!mercadoPagoSdkPromise) {
    mercadoPagoSdkPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://sdk.mercadopago.com/js/v2"]',
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Falha ao carregar Mercado Pago")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://sdk.mercadopago.com/js/v2";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        mercadoPagoSdkPromise = null;
        reject(new Error("Falha ao carregar Mercado Pago"));
      };
      document.head.appendChild(script);
    });
  }

  return mercadoPagoSdkPromise;
}
