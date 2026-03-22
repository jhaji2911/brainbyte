import type { CollectionConfig } from 'payload'

export const Facts: CollectionConfig = {
  slug: 'facts',
  admin: {
    useAsTitle: 'title',
    description: 'Knowledge bytes shown in the dopamine feed and library.',
    defaultColumns: ['title', 'category', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'content'],
    preview: (doc) => {
      if (process.env.NEXT_PUBLIC_API_URL) {
        return `${process.env.NEXT_PUBLIC_API_URL}/facts/${doc.id}`
      }
      return null
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      admin: {
        description: 'The knowledge category this byte belongs to.',
      },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      admin: {
        description: 'The core learning content shown to the user. Keep it punchy—2–5 sentences.',
      },
    },
    {
      name: 'image',
      type: 'text',
      admin: {
        description: 'Optional image URL to display with this byte.',
      },
    },
    {
      name: 'source',
      type: 'text',
      admin: {
        description: 'Optional source URL or citation.',
      },
    },
    {
      name: 'curatedBy',
      type: 'group',
      label: 'Curated By',
      admin: {
        description: 'Optional curator attribution shown on the card.',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Curator Name',
        },
        {
          name: 'avatar',
          type: 'text',
          label: 'Curator Avatar URL',
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Only published bytes appear in the app feed.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When this byte was published. Auto-set when status changes to published.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        // Auto-set publishedAt when status switches to published for the first time
        if (
          data.status === 'published' &&
          !data.publishedAt &&
          (operation === 'create' || originalDoc?.status !== 'published')
        ) {
          data.publishedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  timestamps: true,
}
