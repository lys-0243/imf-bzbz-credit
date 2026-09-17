export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui', margin: 24 }}>
        <header>
          <a href="/">IMF Crédit</a>
          {' · '}
          <a href="/reception">Réception</a>
          {' · '}
          <a href="/agent">Agent</a>
          {' · '}
          <a href="/analyste">Analyste</a>
          {' · '}
          <a href="/conformite">Conformité</a>
          {' · '}
          <a href="/direction">Direction</a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
