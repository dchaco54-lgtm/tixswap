import './globals.css';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'TixSwap',
  description: 'Marketplace de reventa segura de entradas',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-50">
        <Navbar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
