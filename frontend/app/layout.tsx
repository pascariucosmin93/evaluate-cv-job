import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evaluate CV Job",
  description: "Scor de potrivire intre CV si job description"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
