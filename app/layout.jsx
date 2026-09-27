import "./globals.css";
import Header from "./components/Header";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";

export const metadata = {
  title: "TixSwap",
  description:
    "Compra y vende entradas entre personas con reglas claras, soporte y trazabilidad en TixSwap.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="overflow-x-hidden">
      <body className="min-h-[100dvh] overflow-x-hidden antialiased">
        <Header />
        {children}
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
