import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";

export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://dealerflow.ai"), title: { default: "DealerFlow", template: "%s" }, description: "Modern automotive retail operations with focused workflows and explainable intelligence.", openGraph: { type: "website", siteName: "DealerFlow", title: "DealerFlow", description: "Run the dealership from one intelligent workspace." } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className="font-sans"><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider></body></html>;
}
