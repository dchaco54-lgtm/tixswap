import "./globals.css";

export const metadata = {
  title: "TixSwap",
  description: "Compra y vende entradas de manera segura",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
