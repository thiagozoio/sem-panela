import { describe, expect, it } from "vitest";
import { detectPlatform } from "../install";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36";
const INSTAGRAM = `${IPHONE} Instagram 350.0`;
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

describe("detectPlatform", () => {
  it("app já instalado vence tudo", () => expect(detectPlatform(ANDROID, true, false)).toBe("installed"));
  it("iPhone no Safari", () => expect(detectPlatform(IPHONE, false, false)).toBe("ios"));
  it("iPhone em outro navegador", () => expect(detectPlatform(IPHONE_CHROME, false, false)).toBe("ios-other"));
  it("iPad se passando por Mac", () => expect(detectPlatform(MAC, false, true)).toBe("ios"));
  it("Mac de verdade", () => expect(detectPlatform(MAC, false, false)).toBe("desktop"));
  it("Android no Chrome", () => expect(detectPlatform(ANDROID, false, false)).toBe("android"));
  it("navegador de dentro de outro app", () => {
    expect(detectPlatform(ANDROID_WEBVIEW, false, false)).toBe("in-app");
    expect(detectPlatform(INSTAGRAM, false, false)).toBe("in-app");
  });
});
