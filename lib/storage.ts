import { createReadStream, promises as fs } from 'fs'
import { dirname, join, normalize } from 'path'
import crypto from 'crypto'

const DEFAULT_STORAGE_ROOT = normalize(process.env.FILE_STORAGE_ROOT ?? join(process.cwd(), 'storage'))

export interface SaveAttachmentOptions {
  tenantId: string
  activityId: string
  originalName: string
  mimeType: string
  buffer: Buffer
}

export interface SavedAttachment {
  storageKey: string
  fileName: string
  fileSize: number
  mimeType: string
}

async function ensureDirectory(path: string) {
  await fs.mkdir(path, { recursive: true })
}

function safeFileName(originalName: string): string {
  const sanitized = originalName.replace(/[^a-zA-Z0-9\.\-_]+/g, '_')
  const hash = crypto.randomBytes(8).toString('hex')
  const extensionIndex = sanitized.lastIndexOf('.')
  const extension = extensionIndex >= 0 ? sanitized.slice(extensionIndex) : ''
  const base = extensionIndex >= 0 ? sanitized.slice(0, extensionIndex) : sanitized
  const name = base || 'file'
  return `${name}_${hash}${extension}`
}

function resolveStoragePath(storageKey: string): string {
  const resolved = normalize(join(DEFAULT_STORAGE_ROOT, storageKey))
  if (!resolved.startsWith(DEFAULT_STORAGE_ROOT)) {
    throw new Error('Invalid storage key')
  }
  return resolved
}

export async function saveActivityAttachment({
  tenantId,
  activityId,
  originalName,
  mimeType,
  buffer
}: SaveAttachmentOptions): Promise<SavedAttachment> {
  const fileName = safeFileName(originalName)
  const storageKey = join('tenants', tenantId, 'activities', activityId, fileName)
  const absolutePath = resolveStoragePath(storageKey)

  await ensureDirectory(dirname(absolutePath))
  await fs.writeFile(absolutePath, buffer)

  return {
    storageKey,
    fileName,
    fileSize: buffer.byteLength,
    mimeType
  }
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(resolveStoragePath(storageKey))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export function openAttachmentStream(storageKey: string) {
  return createReadStream(resolveStoragePath(storageKey))
}

export async function readAttachmentBuffer(storageKey: string) {
  return fs.readFile(resolveStoragePath(storageKey))
}
