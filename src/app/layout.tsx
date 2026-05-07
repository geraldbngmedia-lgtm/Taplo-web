import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Intelligence Workspace",
  description: "Recruiter interview recording and evidence-based notes workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
