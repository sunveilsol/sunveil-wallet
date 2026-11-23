import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 180 }: QrCodeProps) {
  const [svgDataUrl, setSvgDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: "#ff6a00",
        light: "#0d0d12",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setSvgDataUrl(url);
      })
      .catch(() => {
        if (active) setSvgDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!svgDataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-2xl bg-[#0d0d12] border border-[#ff5500]/25 animate-pulse"
      />
    );
  }

  return (
    <div className="inline-flex p-2.5 rounded-2xl bg-[#0d0d12] border border-[#ff5500]/35 shadow-[0_0_32px_rgba(255,85,0,0.2)]">
      <img
        src={svgDataUrl}
        alt="Private Pay Link QR Code"
        width={size}
        height={size}
        className="rounded-xl block"
      />
    </div>
  );
}
