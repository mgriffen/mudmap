/**
 * API client for the mudmap FastAPI backend.
 *
 * In development, Vite proxies /api to localhost:8000.
 * In production, requests go directly to the FastAPI server.
 */
import type { MapData, MapSummary } from '../types/map'
import { migrateMapData } from '../types/map'

const BASE = '/api'

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export const listMaps = () =>
  request<MapSummary[]>('GET', '/maps')

export const getMap = async (id: string): Promise<MapData> => {
  const raw = await request<unknown>('GET', `/maps/${id}`)
  return migrateMapData(raw)
}

export const createMap = (data: MapData) =>
  request<MapData>('POST', '/maps', data)

export const saveMap = (data: MapData) =>
  request<MapData>('PUT', `/maps/${data.id}`, data)

export const deleteMap = (id: string) =>
  request<void>('DELETE', `/maps/${id}`)
