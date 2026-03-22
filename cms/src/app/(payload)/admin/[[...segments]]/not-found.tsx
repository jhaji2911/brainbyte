import { NotFoundPage } from '@payloadcms/next/views'
import configPromise from '@payload-config'
import { importMap } from '../importMap.js'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

const NotFound = (args: Args) => (
  <NotFoundPage config={configPromise} importMap={importMap} {...args} />
)

export default NotFound
