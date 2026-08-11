export const FILE_TRANSFER_CONFIG = {
  TESTING_MODE: true,

  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500 MB temporary test limit

  ALLOWED_CATEGORIES: ['image', 'video', 'document', 'file'] as const,

  CHUNK_SIZE: 64 * 1024, // 64 KB
}
