import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    description: 'Knowledge categories shown in the Poison selector during onboarding.',
    defaultColumns: ['name', 'slug', 'icon', 'updatedAt'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Used as the category value in fact filters (e.g. "science", "history").',
      },
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Emoji or icon identifier displayed alongside the category.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
