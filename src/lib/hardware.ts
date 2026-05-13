// Hardware periféricos via Web APIs nativas (sem extensão/driver).
// Funciona em Chrome/Edge (não Firefox/Safari). Verifica suporte antes.

// ─── BLUETOOTH BARCODE SCANNER ────────────────────────────────────────────────
// Suporta scanners HID-keyboard mode (a maioria — Symbol, Honeywell, Datalogic
// via dongle USB-Bluetooth aparecem como teclado e disparam keydown).
// Para scanners Bluetooth Low Energy (SPP profile, ex: TaoTronics) usa Web Bluetooth.

export function listenKeyboardScanner(onScan: (code: string) => void) {
  // Heurística: caracteres seguidos sem pausa + Enter no final = scanner
  let buf = "";
  let last = Date.now();
  const TIMEOUT = 50; // ms entre chars — humano digita >50ms, scanner <20ms

  const handler = (e: KeyboardEvent) => {
    const now = Date.now();
    if (now - last > TIMEOUT && buf.length > 0) buf = "";
    last = now;

    if (e.key === "Enter" && buf.length >= 6) {
      const code = buf;
      buf = "";
      // Ignora se foco em input editável (humano digitando), exceto se for HID rápido
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (now - last < 30) onScan(code); // ainda processa se velocidade típica de scanner
        return;
      }
      onScan(code);
      return;
    }

    if (e.key.length === 1) {
      buf += e.key;
      if (buf.length > 50) buf = ""; // overflow safety
    }
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

// Web Bluetooth (para scanners BLE com serviço SPP customizado)
export async function connectBluetoothScanner(onScan: (code: string) => void) {
  if (!(navigator as any).bluetooth) {
    throw new Error("Web Bluetooth não disponível neste navegador (use Chrome/Edge)");
  }
  const device = await (navigator as any).bluetooth.requestDevice({
    filters: [{ services: ["battery_service"] }],
    optionalServices: ["00001101-0000-1000-8000-00805f9b34fb"], // SPP UUID
  });
  const server = await device.gatt!.connect();
  // Maioria dos scanners BLE expõe notify char — handler genérico
  const services = await server.getPrimaryServices();
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.notify) {
        await ch.startNotifications();
        ch.addEventListener("characteristicvaluechanged", (e: any) => {
          const v = e.target.value as DataView;
          const text = new TextDecoder().decode(v.buffer).trim();
          if (text.length >= 4) onScan(text);
        });
      }
    }
  }
  return device;
}

// ─── WEBUSB THERMAL PRINTER (ESC/POS) ─────────────────────────────────────────
// Suporta impressoras 58mm/80mm via USB direto (sem driver Windows).
// Funciona com Epson TM-T20/T88, Bematech MP-4200, Daruma, Elgin, etc.
// Em Chrome/Edge precisa do site servido em HTTPS.

const ESC = 0x1b;
const GS = 0x1d;

class EscPosBuilder {
  private bytes: number[] = [];

  raw(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }

  init() {
    return this.raw(ESC, 0x40);
  }

  align(a: "left" | "center" | "right") {
    return this.raw(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  size(w: 1 | 2 | 3, h: 1 | 2 | 3) {
    return this.raw(GS, 0x21, ((w - 1) << 4) | (h - 1));
  }

  text(s: string) {
    // CP850/CP1252 — converte ASCII direto + chars latinos
    for (const ch of s) {
      const code = ch.charCodeAt(0);
      this.bytes.push(code < 128 ? code : 63); // ? para chars não-ASCII
    }
    return this;
  }

  textLn(s: string) {
    return this.text(s).raw(0x0a);
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.bytes.push(0x0a);
    return this;
  }

  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  drawer() {
    return this.raw(ESC, 0x70, 0x00, 0x32, 0xfa);
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export interface UsbPrinter {
  device: any;
  send: (cmd: Uint8Array) => Promise<void>;
  builder: () => EscPosBuilder;
}

export async function connectUsbPrinter(): Promise<UsbPrinter> {
  const nav = navigator as any;
  if (!nav.usb) throw new Error("WebUSB não disponível (use Chrome/Edge em HTTPS)");

  const device = await nav.usb.requestDevice({ filters: [] });
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  await device.claimInterface(device.configuration.interfaces[0].interfaceNumber);

  const epOut = device.configuration.interfaces[0].alternate.endpoints.find(
    (e: any) => e.direction === "out",
  );
  if (!epOut) throw new Error("Impressora sem endpoint de saída");

  return {
    device,
    send: async (cmd: Uint8Array) => {
      await device.transferOut(epOut.endpointNumber, cmd);
    },
    builder: () => new EscPosBuilder(),
  };
}

export async function printReceipt(
  printer: UsbPrinter,
  lines: { text: string; bold?: boolean; align?: "left" | "center" | "right"; size?: 1 | 2 }[],
) {
  const b = printer.builder().init();
  for (const line of lines) {
    b.align(line.align ?? "left").bold(!!line.bold);
    if (line.size === 2) b.size(2, 2);
    else b.size(1, 1);
    b.textLn(line.text);
  }
  b.feed(3).cut();
  await printer.send(b.build());
}

// Suporte detection helpers
export const hardwareSupport = {
  webusb: typeof navigator !== "undefined" && !!(navigator as any).usb,
  bluetooth: typeof navigator !== "undefined" && !!(navigator as any).bluetooth,
  hid: typeof navigator !== "undefined" && !!(navigator as any).hid,
};
