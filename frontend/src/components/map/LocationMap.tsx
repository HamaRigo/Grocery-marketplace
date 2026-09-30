import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { LocateFixed, MapPin } from 'lucide-react'
import Button from '../ui/Button'

export interface MapPoint {
  lat: number
  lng: number
}

export interface MapMarkerData {
  id: string
  position: MapPoint
  title?: string
  color?: string
}

interface LocationMapProps {
  center: MapPoint
  markers?: MapMarkerData[]
  selected?: MapPoint | null
  onSelect?: (point: MapPoint) => void
  onMarkerClick?: (id: string) => void
  height?: string
  className?: string
  interactiveSelect?: boolean
  showLocate?: boolean
  onLocate?: () => void
  zoom?: number
}

const DEFAULT_CENTER: MapPoint = { lat: 36.81, lng: 10.17 }
const TILE_SIZE = 256
const MAP_ZOOM = 12
const MAP_WORLD_SIZE = TILE_SIZE * 2 ** MAP_ZOOM
const PAN_DURATION_MS = 420
const DRAG_THRESHOLD_PX = 6

function lngToWorldX(lng: number) {
  return ((lng + 180) / 360) * MAP_WORLD_SIZE
}
function latToWorldY(lat: number) {
  const latRad = lat * Math.PI / 180
  return (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) * MAP_WORLD_SIZE
}
function worldXToLng(x: number) {
  return (x / MAP_WORLD_SIZE) * 360 - 180
}
function worldYToLat(y: number) {
  const n = Math.PI - (2 * Math.PI * y) / MAP_WORLD_SIZE
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}
function clampLat(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat))
}
function normalizeLng(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}
function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function worldFromPoint(point: MapPoint) {
  return { x: lngToWorldX(point.lng), y: latToWorldY(clampLat(point.lat)) }
}
function pointFromWorld(x: number, y: number): MapPoint {
  return {
    lat: clampLat(worldYToLat(Math.max(0, Math.min(MAP_WORLD_SIZE, y)))),
    lng: normalizeLng(worldXToLng(x)),
  }
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

function GoogleLocationMap({
  center,
  markers = [],
  selected,
  onSelect,
  onMarkerClick,
  height = '18rem',
  className = '',
  interactiveSelect,
  showLocate,
  onLocate,
  zoom = 13,
}: LocationMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY!,
    id: 'bakala-maps',
  })

  if (loadError) {
    return <OsmLocationMap {...{ center, markers, selected, onSelect, onMarkerClick, height, className, interactiveSelect, showLocate, onLocate, zoom }} />
  }

  if (!isLoaded) {
    return (
      <div className={`rounded-card border border-line bg-surface-muted skeleton ${className}`} style={{ height }} />
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-card border border-line shadow-soft ${className}`} style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
          ],
        }}
        onClick={e => {
          if (!interactiveSelect || !onSelect || !e.latLng) return
          onSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        }}
      >
        {selected && (
          <MarkerF position={selected} icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#16a34a',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          }} />
        )}
        {markers.map(m => (
          <MarkerF
            key={m.id}
            position={m.position}
            title={m.title}
            onClick={() => onMarkerClick?.(m.id)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: m.color ?? '#16a34a',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
          />
        ))}
      </GoogleMap>
      {showLocate && onLocate && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute bottom-3 right-3 z-50 shadow-lift"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onLocate();
          }}
          aria-label="Use my location"
        >
          <LocateFixed className="h-4 w-4 text-brand-600" />
        </Button>
      )}
    </div>
  )
}

function OsmLocationMap({
  center,
  markers = [],
  selected,
  onSelect,
  onMarkerClick,
  height = '18rem',
  className = '',
  interactiveSelect,
  showLocate,
  onLocate,
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const viewCenterRef = useRef<MapPoint>(center)
  const animFrameRef = useRef<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originWorldX: number
    originWorldY: number
    moved: boolean
  } | null>(null)

  const [size, setSize] = useState({ width: 0, height: 288 })
  const [viewCenter, setViewCenter] = useState<MapPoint>(center)
  const [isDragging, setIsDragging] = useState(false)
  const [pinKey, setPinKey] = useState(0)

  const setViewCenterNow = useCallback((point: MapPoint) => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = null
    viewCenterRef.current = point
    setViewCenter(point)
  }, [])

  const animateToCenter = useCallback((target: MapPoint) => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current)
    const from = worldFromPoint(viewCenterRef.current)
    const to = worldFromPoint(target)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / PAN_DURATION_MS)
      const eased = easeOutCubic(t)
      const next = pointFromWorld(lerp(from.x, to.x, eased), lerp(from.y, to.y, eased))
      viewCenterRef.current = next
      setViewCenter(next)
      if (t < 1) animFrameRef.current = requestAnimationFrame(step)
      else {
        animFrameRef.current = null
        viewCenterRef.current = target
        setViewCenter(target)
      }
    }
    animFrameRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect
      setSize({ width, height: h })
    })
    observer.observe(mapRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current)
  }, [])

  useEffect(() => {
    animateToCenter(center)
  }, [center.lat, center.lng, animateToCenter])

  useEffect(() => {
    if (selected) setPinKey(k => k + 1)
  }, [selected?.lat, selected?.lng])

  const centerWorld = worldFromPoint(viewCenter)
  const topLeft = { x: centerWorld.x - size.width / 2, y: centerWorld.y - size.height / 2 }
  const tileCount = 2 ** MAP_ZOOM
  const startTileX = Math.floor(topLeft.x / TILE_SIZE) - 1
  const endTileX = Math.floor((topLeft.x + size.width) / TILE_SIZE) + 1
  const startTileY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE) - 1)
  const endTileY = Math.min(tileCount - 1, Math.floor((topLeft.y + size.height) / TILE_SIZE) + 1)

  const tiles = useMemo(() => {
    const list: { key: string; url: string; left: number; top: number }[] = []
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount
        list.push({
          key: `${tileX}-${tileY}`,
          url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - topLeft.x,
          top: tileY * TILE_SIZE - topLeft.y,
        })
      }
    }
    return list
  }, [endTileX, endTileY, startTileX, startTileY, tileCount, topLeft.x, topLeft.y])

  const selectedScreen = selected
    ? { left: lngToWorldX(selected.lng) - topLeft.x, top: latToWorldY(clampLat(selected.lat)) - topLeft.y }
    : null

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const current = worldFromPoint(viewCenterRef.current)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWorldX: current.x,
      originWorldY: current.y,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    setIsDragging(true)
    setViewCenterNow(pointFromWorld(
      drag.originWorldX - dx,
      Math.max(0, Math.min(MAP_WORLD_SIZE, drag.originWorldY - dy)),
    ))
  }, [setViewCenterNow])

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const wasDrag = drag.moved
    dragRef.current = null
    setIsDragging(false)
    if (wasDrag || !interactiveSelect || !onSelect) return
    const rect = event.currentTarget.getBoundingClientRect()
    const live = worldFromPoint(viewCenterRef.current)
    const worldX = live.x - size.width / 2 + (event.clientX - rect.left)
    const worldY = live.y - size.height / 2 + (event.clientY - rect.top)
    onSelect({ lat: worldYToLat(worldY), lng: worldXToLng(worldX) })
  }, [interactiveSelect, onSelect, size.height, size.width])

  return (
    <div
      ref={mapRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      className={`relative overflow-hidden rounded-card border border-line bg-surface-muted shadow-soft touch-none select-none ${
        isDragging ? 'cursor-grabbing' : interactiveSelect ? 'cursor-crosshair' : 'cursor-grab'
      } ${className}`}
      style={{ height }}
    >
      {tiles.map(tile => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          className="absolute max-w-none pointer-events-none"
          style={{ width: TILE_SIZE, height: TILE_SIZE, left: tile.left, top: tile.top }}
        />
      ))}

      {markers.map(m => {
        const left = lngToWorldX(m.position.lng) - topLeft.x
        const top = latToWorldY(clampLat(m.position.lat)) - topLeft.y
        return (
          <button
            key={m.id}
            type="button"
            className="absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{ left, top }}
            onClick={e => { e.stopPropagation(); onMarkerClick?.(m.id) }}
            aria-label={m.title ?? 'Store marker'}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white shadow-lift"
              style={{ backgroundColor: m.color ?? '#16a34a' }}
            >
              <MapPin className="h-3.5 w-3.5 text-white" />
            </span>
          </button>
        )
      })}

      {selectedScreen && (
        <div
          key={pinKey}
          className="pointer-events-none absolute z-20 animate-map-pin-drop"
          style={{ left: selectedScreen.left, top: selectedScreen.top }}
          aria-label="Selected location"
        >
          <div className="absolute left-1/2 top-full h-5 w-5 animate-map-pin-pulse rounded-full bg-brand-500/30" />
          <div className="h-8 w-8 rounded-full border-4 border-white bg-brand-600 shadow-lift" />
          <div className="absolute left-1/2 top-7 h-3 w-3 -translate-x-1/2 rotate-45 bg-brand-600 border-b border-r border-white" />
        </div>
      )}

      {showLocate && onLocate && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute bottom-3 right-3 z-50 shadow-lift"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onLocate();
          }}
          aria-label="Use my location"
        >
          <LocateFixed className="h-4 w-4 text-brand-600" />
        </Button>
      )}

      <div className="absolute bottom-2 left-2 z-30 rounded-lg bg-surface-raised/90 px-2 py-1 text-[10px] text-ink-faint border border-line">
        OpenStreetMap
      </div>
    </div>
  )
}

export default function LocationMap(props: LocationMapProps) {
  const center = props.center ?? DEFAULT_CENTER
  if (GOOGLE_MAPS_KEY) {
    return <GoogleLocationMap {...props} center={center} />
  }
  return <OsmLocationMap {...props} center={center} />
}

export { DEFAULT_CENTER, GOOGLE_MAPS_KEY }
