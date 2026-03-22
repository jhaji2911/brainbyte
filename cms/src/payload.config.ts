import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { Users } from './collections/Users.ts'
import { Facts } from './collections/Facts.ts'
import { Categories } from './collections/Categories.ts'
import { Media } from './collections/Media.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',

  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— BrainByte CMS',
      description: 'Manage knowledge bytes for the BrainByte app.',
    },
  },

  collections: [Users, Facts, Categories, Media],

  editor: lexicalEditor({}),

  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./bbyte-cms.db',
    },
  }),

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  // Expose the Payload REST API to the Rust API
  cors: [
    'http://localhost:8080',
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  ].filter(Boolean),

  csrf: [
    'http://localhost:3000',
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  ].filter(Boolean),

  // Store uploaded media under /public/media
  upload: {
    limits: {
      fileSize: 5_000_000, // 5 MB
    },
  },
})
