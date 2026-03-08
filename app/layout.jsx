import "./globals.css";
import Header from "./components/Header";

export const metadata = {
  title: "TixSwap",
  description: "Marketplace de reventa segura de entradas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="overflow-x-hidden">
      <body className="min-h-[100dvh] overflow-x-hidden antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
