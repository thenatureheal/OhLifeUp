import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import ContentGuard from "@/components/ContentGuard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "OhLifeUp — 글로벌 구매대행 파트너",
  description:
    "중국 전문 사입부터 LifeUpCoaching 제품 대행, BGI 대량유전자분석 패키지 결제까지 — 투명하고 빠른 글로벌 구매대행 서비스.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>
          <ContentGuard />
          <Header />
          <main className="min-h-[60vh] pt-16">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
