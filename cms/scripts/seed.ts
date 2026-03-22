/**
 * Seed script: imports the hard-coded facts from the Rust API seed data
 * into Payload CMS so you have content to start from.
 *
 * Usage (after `npm run dev` has run once to create the DB and admin user):
 *   node --import tsx/esm scripts/seed.ts
 *
 * Requirements:
 *   - CMS must be running (npm run dev) OR the DB must exist
 *   - Set PAYLOAD_SECRET in .env
 */

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import payload from 'payload'
import configPromise from '../src/payload.config.ts'

const dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  await payload.init({ config: configPromise })

  // Ensure default categories exist
  const categories = [
    { name: 'Vocabulary', slug: 'vocabulary', icon: '📖' },
    { name: 'Science', slug: 'science', icon: '🔬' },
    { name: 'Psychology', slug: 'psychology', icon: '🧠' },
    { name: 'Neuroscience', slug: 'neuroscience', icon: '🧬' },
    { name: 'Productivity', slug: 'productivity', icon: '⚡' },
    { name: 'History', slug: 'history', icon: '🏛️' },
    { name: 'Technology', slug: 'technology', icon: '💻' },
    { name: 'Philosophy', slug: 'philosophy', icon: '🤔' },
    { name: 'Mathematics', slug: 'mathematics', icon: '📐' },
    { name: 'Curiosity', slug: 'curiosity', icon: '✨' },
  ]

  const categoryMap: Record<string, number> = {}
  for (const cat of categories) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      categoryMap[cat.slug] = existing.docs[0].id as number
      console.log(`Category exists: ${cat.name}`)
    } else {
      const created = await payload.create({ collection: 'categories', data: cat })
      categoryMap[cat.slug] = created.id as number
      console.log(`Created category: ${cat.name}`)
    }
  }

  // Seed facts matching the Rust API's hard-coded seed data
  const facts = [
    {
      title: 'Petrichor',
      categorySlug: 'vocabulary',
      content:
        "The pleasant, earthy smell that frequently accompanies the first rain after a long period of warm, dry weather.",
      curatedBy: { name: 'EtymologyNow', avatar: 'https://picsum.photos/seed/etym/100/100' },
    },
    {
      title: 'Why the Sky is Blue',
      categorySlug: 'science',
      content:
        "It's all about Rayleigh scattering. Sunlight reaches Earth's atmosphere and is scattered in all directions by gases and particles. Blue light has shorter wavelengths and scatters more strongly, so the sky appears blue to us.",
      image:
        'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=1000',
      source: 'NASA Science',
    },
    {
      title: 'The Pratfall Effect',
      categorySlug: 'psychology',
      content:
        'Highly competent people can become more likable after making a small mistake because the mistake signals humanity instead of distance.',
    },
    {
      title: 'Myelin Sheaths',
      categorySlug: 'neuroscience',
      content:
        'Repeated practice strengthens neural signal delivery by improving myelination, which helps the pathway fire faster and more reliably.',
    },
    {
      title: 'Zeigarnik Effect',
      categorySlug: 'productivity',
      content:
        'People tend to remember unfinished tasks better than completed ones, which is why open loops keep tugging at your attention.',
      image:
        'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=1000',
    },
  ]

  for (const fact of facts) {
    const categoryId = categoryMap[fact.categorySlug]
    if (!categoryId) {
      console.warn(`No category found for slug: ${fact.categorySlug}`)
      continue
    }

    const existing = await payload.find({
      collection: 'facts',
      where: { title: { equals: fact.title } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`Fact exists: ${fact.title}`)
      continue
    }

    await payload.create({
      collection: 'facts',
      data: {
        title: fact.title,
        category: categoryId,
        content: fact.content,
        image: fact.image,
        source: fact.source,
        curatedBy: fact.curatedBy,
        status: 'published',
        publishedAt: new Date().toISOString(),
      },
    })
    console.log(`Created fact: ${fact.title}`)
  }

  console.log('\nSeed complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
