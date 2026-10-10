import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'TicketFlow — Support desk',
  description: 'Customer support ticketing app built with Next.js, Node.js and PostgreSQL',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 px-4 py-6 md:h-screen md:overflow-y-auto md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
