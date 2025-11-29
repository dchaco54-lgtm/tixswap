import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "TixSwap",
  description: "Compra y vende entradas con seguridad",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-white text-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

