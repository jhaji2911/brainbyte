import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'BrainByte CMS',
  description: 'Content management for the BrainByte app.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
