import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'filename',
    description: 'Uploaded images for facts, curator avatars, and category icons.',
  },
  upload: true,
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt Text',
      admin: {
        description: 'Describes the image for accessibility and SEO.',
      },
    },
  ],
}
