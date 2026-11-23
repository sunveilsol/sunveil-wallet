import QRCode from "qrcode";
import { sanitizeHandle, shortAddr } from "./vault";

export interface PayCardOptions {
  handle: string;
  solanaAddress: string;
  payLinkUrl: string;
  presetAmount?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("QR-Code Bild konnte nicht geladen werden."));
    img.src = src;
  });
}

/**
 * Generates a crisp 1200x675 (16:9 X-ready) Obsidian & Neon-Orange PNG Private Pay-Card
 * entirely client-side and triggers a browser download.
 */
export async function downloadPrivatePayCardPng(options: PayCardOptions): Promise<string> {
  const width = 1200;
  const height = 675;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas-Kontext nicht verfügbar.");
  }

  const safeHandle = sanitizeHandle(options.handle) || "sunveil";
  const amountLabel = options.presetAmount?.trim()
    ? `${options.presetAmount.trim().replace(",", ".")} SOL`
    : "ANY AMOUNT · SOL";

  // 1. Deep Obsidian background
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle ambient ember radial glows
  const glowLeft = ctx.createRadialGradient(220, 140, 20, 220, 140, 520);
  glowLeft.addColorStop(0, "rgba(255, 92, 0, 0.24)");
  glowLeft.addColorStop(0.55, "rgba(255, 69, 0, 0.06)");
  glowLeft.addColorStop(1, "rgba(7, 7, 9, 0)");
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, width, height);

  const glowRight = ctx.createRadialGradient(930, 340, 30, 930, 340, 420);
  glowRight.addColorStop(0, "rgba(255, 118, 26, 0.22)");
  glowRight.addColorStop(0.6, "rgba(255, 85, 0, 0.05)");
  glowRight.addColorStop(1, "rgba(7, 7, 9, 0)");
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, width, height);

  // 3. Outer subtle card frame
  drawRoundedRect(ctx, 28, 28, width - 56, height - 56, 36);
  ctx.fillStyle = "rgba(15, 14, 20, 0.88)";
  ctx.fill();
  ctx.lineWidth = 2;
  const borderGrad = ctx.createLinearGradient(28, 28, width - 28, height - 28);
  borderGrad.addColorStop(0, "rgba(255, 115, 30, 0.55)");
  borderGrad.addColorStop(0.5, "rgba(255, 85, 0, 0.18)");
  borderGrad.addColorStop(1, "rgba(255, 138, 0, 0.45)");
  ctx.strokeStyle = borderGrad;
  ctx.stroke();

  // 4. Decorative Eclipse Rings behind left headline
  ctx.save();
  ctx.strokeStyle = "rgba(255, 106, 0, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(170, 500, 170, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(170, 500, 240, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 5. SUNVEIL Brand Emblem (top-left)
  drawRoundedRect(ctx, 76, 74, 58, 58, 16);
  const logoGrad = ctx.createLinearGradient(76, 74, 134, 132);
  logoGrad.addColorStop(0, "#ff7a1a");
  logoGrad.addColorStop(1, "#c93700");
  ctx.fillStyle = logoGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(105, 103, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#09090d";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 32px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("SUNVEIL", 150, 111);

  // Pill badge
  drawRoundedRect(ctx, 305, 84, 215, 36, 18);
  ctx.fillStyle = "rgba(255, 85, 0, 0.14)";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255, 106, 0, 0.45)";
  ctx.stroke();
  ctx.fillStyle = "#ff944d";
  ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("PRIVATE PAY-LINK", 344, 107);

  // 6. Main headline & handle
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "600 18px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("PAY ME PRIVATELY ON SOLANA", 76, 206);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  const displayHandle = `@${safeHandle}`;
  ctx.fillText(displayHandle.length > 18 ? `${displayHandle.slice(0, 17)}…` : displayHandle, 76, 276);

  // Suggested amount pill
  drawRoundedRect(ctx, 76, 314, 340, 62, 18);
  ctx.fillStyle = "rgba(255, 85, 0, 0.12)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 106, 0, 0.4)";
  ctx.stroke();

  ctx.fillStyle = "#ff8533";
  ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("SHIELDED AMOUNT", 100, 338);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(amountLabel, 100, 365);

  // Privacy bullet copy
  ctx.fillStyle = "#d4d4d8";
  ctx.font = "500 20px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("• Amount encrypted onchain via Groth16 ZK", 76, 434);
  ctx.fillText("• Powered by Helius Solana Privacy Rings", 76, 468);
  ctx.fillText("• 100% Non-Custodial · Zero keys on servers", 76, 502);

  // Address chip
  drawRoundedRect(ctx, 76, 540, 340, 44, 22);
  ctx.fillStyle = "rgba(9, 9, 13, 0.9)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.stroke();
  ctx.fillStyle = "#ff944d";
  ctx.font = "600 16px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(shortAddr(options.solanaAddress, 9, 9), 104, 568);

  // 7. Right QR Card container
  const qrBoxX = 766;
  const qrBoxY = 96;
  const qrBoxW = 358;
  const qrBoxH = 478;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 28);
  ctx.fillStyle = "#0a0a0f";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 106, 0, 0.45)";
  ctx.stroke();

  const qrDataUrl = await QRCode.toDataURL(options.payLinkUrl, {
    width: 600,
    margin: 2,
    color: {
      dark: "#ff7214",
      light: "#0d0d13",
    },
    errorCorrectionLevel: "M",
  });
  const qrImg = await loadImage(qrDataUrl);

  drawRoundedRect(ctx, qrBoxX + 29, qrBoxY + 29, 300, 300, 20);
  ctx.save();
  ctx.clip();
  ctx.drawImage(qrImg, qrBoxX + 29, qrBoxY + 29, 300, 300);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("Scan to Pay Privately", qrBoxX + qrBoxW / 2, qrBoxY + 378);

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillText("Shielded UTXOs · Sub-Second Proofs", qrBoxX + qrBoxW / 2, qrBoxY + 410);

  ctx.fillStyle = "#ff8533";
  ctx.font = "600 15px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("sunveil-wallet.vercel.app", qrBoxX + qrBoxW / 2, qrBoxY + 446);
  ctx.textAlign = "left";

  // 8. Footer strip
  ctx.fillStyle = "#71717a";
  ctx.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("SUNVEIL · SOLANA PRIVACY POCKET WALLET · @SunVeilSol", 76, 616);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("PNG Export fehlgeschlagen."));
    }, "image/png");
  });

  const filename = `SUNVEIL_PayCard_${safeHandle}.png`;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return filename;
}
