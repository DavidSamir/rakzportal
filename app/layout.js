import "./globals.css";

export const metadata = {
  title: "RAKEZ Document Viewer",
  description: "Verify and preview RAKEZ documents by reference code.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
