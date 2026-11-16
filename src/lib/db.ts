import type { Asset, Project } from './types'

const DB_NAME = 'clippro'
const DB_VERSION = 1
const PROJECTS = 'projects'
const ASSETS = 'assets'

interface StoredAsset {
  id: string
  meta: Omit<Asset, 'url'>
  blob: Blob
}

interface StoredProject {
  id: string
  project: Project
  thumbnail?: string
  updatedAt: number
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  width: number
  height: number
  fps: number
  thumbnail?: string
  clipCount: number
  duration: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(PROJECTS)) {
          const store = db.createObjectStore(PROJECTS, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains(ASSETS)) {
          db.createObjectStore(ASSETS, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function saveAssetRecord(asset: Asset, blob: Blob): Promise<void> {
  const db = await openDb()
  const { url: _url, ...meta } = asset
  const record: StoredAsset = { id: asset.id, meta, blob }
  const tx = db.transaction(ASSETS, 'readwrite')
  tx.objectStore(ASSETS).put(record)
  await txDone(tx)
}

export async function deleteAssetRecord(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(ASSETS, 'readwrite')
  tx.objectStore(ASSETS).delete(id)
  await txDone(tx)
}

export async function loadAssetRecords(ids: string[]): Promise<Asset[]> {
  const db = await openDb()
  const tx = db.transaction(ASSETS, 'readonly')
  const store = tx.objectStore(ASSETS)
  const results = await Promise.all(ids.map((id) => requestToPromise(store.get(id)) as Promise<StoredAsset | undefined>))
  await txDone(tx)
  return results
    .filter((record): record is StoredAsset => Boolean(record))
    .map((record) => ({
      ...record.meta,
      url: URL.createObjectURL(record.blob),
    }))
}

export async function saveProjectRecord(project: Project, thumbnail?: string): Promise<void> {
  const db = await openDb()
  let existing: StoredProject | undefined
  if (thumbnail === undefined) {
    const readTx = db.transaction(PROJECTS, 'readonly')
    existing = (await requestToPromise(
      readTx.objectStore(PROJECTS).get(project.id),
    )) as StoredProject | undefined
    await txDone(readTx)
  }
  const record: StoredProject = {
    id: project.id,
    project,
    thumbnail: thumbnail ?? existing?.thumbnail,
    updatedAt: project.updatedAt,
  }
  const tx = db.transaction(PROJECTS, 'readwrite')
  tx.objectStore(PROJECTS).put(record)
  await txDone(tx)
}

export async function loadProject(id: string): Promise<{ project: Project; assets: Asset[] } | null> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readonly')
  const record = (await requestToPromise(tx.objectStore(PROJECTS).get(id))) as StoredProject | undefined
  await txDone(tx)
  if (!record) return null
  const assets = await loadAssetRecords(record.project.assetIds)
  return { project: record.project, assets }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readonly')
  const records = (await requestToPromise(tx.objectStore(PROJECTS).getAll())) as StoredProject[]
  await txDone(tx)
  return records
    .map((record) => {
      const p = record.project
      let clipCount = 0
      let end = 0
      for (const track of p.tracks) {
        clipCount += track.clips.length
        for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration)
      }
      return {
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
        width: p.width,
        height: p.height,
        fps: p.fps,
        thumbnail: record.thumbnail,
        clipCount,
        duration: end,
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProjectRecord(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readwrite')
  tx.objectStore(PROJECTS).delete(id)
  await txDone(tx)
}

/**
 * Removes projects and any assets no longer referenced by another project.
 */
export async function deleteProjectsAndOrphanAssets(ids: string[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([PROJECTS, ASSETS], 'readwrite')
  const projectStore = tx.objectStore(PROJECTS)
  const assetStore = tx.objectStore(ASSETS)
  const allRecords = (await requestToPromise(projectStore.getAll())) as StoredProject[]
  const keepIds = new Set<string>()
  for (const record of allRecords) {
    if (ids.includes(record.id)) continue
    for (const assetId of record.project.assetIds) keepIds.add(assetId)
  }
  const deletedAssetIds = new Set<string>()
  for (const record of allRecords) {
    if (ids.includes(record.id)) {
      for (const assetId of record.project.assetIds) deletedAssetIds.add(assetId)
      projectStore.delete(record.id)
    }
  }
  for (const assetId of deletedAssetIds) {
    if (!keepIds.has(assetId)) assetStore.delete(assetId)
  }
  await txDone(tx)
}

export async function clearAllData(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([PROJECTS, ASSETS], 'readwrite')
  tx.objectStore(PROJECTS).clear()
  tx.objectStore(ASSETS).clear()
  await txDone(tx)
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    // Storage persistence is a nice-to-have; ignore failures.
  }
  return false
}
