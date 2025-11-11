import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Latency Topology Visualizer",
  description: "3D latency map for exchange + cloud regions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
