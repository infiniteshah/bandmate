import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BandMate",
  description: "Photograph an object, form a band.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#efe9dd",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain">
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col px-5 pb-10 pt-6">
          {children}
        </div>
      </body>
    </html>
  );
}
