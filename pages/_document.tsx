import { Html, Head, Main, NextScript } from 'next/document'

// Minimal Document to satisfy Next's pages runtime when mixing with App Router.
// This is a no-op for App Router routes but prevents '/_document' resolution errors.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

