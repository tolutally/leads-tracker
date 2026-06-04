import "./globals.css";

export const metadata = {
  title: "Clarivue · Pipeline Intelligence",
  description: "Dump a transcript, email, or thread — it reads the sales signal and logs it.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
