import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'TOX INTL Document Processing',
  description: 'Controlled full stack engineering assignment'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <div className="brandMark">TOX</div>
          <div>
            <strong>TOX INTL</strong>
            <span>Document Processing</span>
          </div>
        </header>
        <main>{children}</main>
        <footer>contact@toxintl.com</footer>
      </body>
    </html>
  );
}
