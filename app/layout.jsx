import "./globals.css";
import Header from "./components/Header";

export const metadata = {
  title: "TixSwap",
  description: "Marketplace de reventa segura de entradas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
