// Greater Durban suburbs with rough centroids, and the distance between them.
//
// Real road distances live in the generated distances.js, measured once from
// OpenStreetMap. The coordinates below are still used to place a suburb and to
// estimate anything the generated table doesn't cover.
//
// After adding a suburb here, run `npm run build:distances` to measure it.

import { roadDistanceKm } from './distances.js'

export const PLACES = [
  { name: 'Durban CBD', lat: -29.8587, lng: 31.0218 },
  { name: 'Berea', lat: -29.85, lng: 31.0 },
  { name: 'Morningside', lat: -29.8333, lng: 31.0167 },
  { name: 'Glenwood', lat: -29.8667, lng: 30.9833 },
  { name: 'Umbilo', lat: -29.8667, lng: 30.9833 },
  { name: 'Durban North', lat: -29.7833, lng: 31.0333 },
  { name: 'La Lucia', lat: -29.75, lng: 31.0667 },
  { name: 'Umhlanga', lat: -29.7275, lng: 31.0847 },
  { name: 'Mount Edgecombe', lat: -29.7167, lng: 31.0333 },
  { name: 'Phoenix', lat: -29.7, lng: 30.9833 },
  { name: 'KwaMashu', lat: -29.7333, lng: 30.9833 },
  { name: 'Verulam', lat: -29.65, lng: 31.05 },
  { name: 'Tongaat', lat: -29.5833, lng: 31.1167 },
  { name: 'Ballito', lat: -29.5386, lng: 31.2144 },
  { name: 'Westville', lat: -29.8333, lng: 30.9167 },
  { name: 'Pinetown', lat: -29.8167, lng: 30.85 },
  { name: 'Queensburgh', lat: -29.8667, lng: 30.8667 },
  { name: 'Kloof', lat: -29.7833, lng: 30.8333 },
  { name: 'Hillcrest', lat: -29.7833, lng: 30.7667 },
  { name: 'Chatsworth', lat: -29.9167, lng: 30.8833 },
  { name: 'Umlazi', lat: -29.9667, lng: 30.8833 },
  { name: 'Bluff', lat: -29.9333, lng: 31.0167 },
  { name: 'Isipingo', lat: -29.9833, lng: 30.9333 },
  { name: 'Amanzimtoti', lat: -30.05, lng: 30.8833 },
  { name: 'Pietermaritzburg', lat: -29.6006, lng: 30.3794 },
  { name: 'Richards Bay', lat: -28.7807, lng: 32.0383 },
]

export const placeByName = (name) => PLACES.find((p) => p.name === name)

const R = 6371 // km

function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Distance for a job, in km.
 *
 * Prefers the real road distance measured from OpenStreetMap and baked into
 * distances.js — those are actual driving routes, so they account for the
 * harbour, the freeways and the one-way system rather than guessing.
 *
 * Falls back to a padded straight line for any suburb the table doesn't cover
 * yet (one added to PLACES without re-running `npm run build:distances`), so
 * adding a suburb degrades the estimate instead of breaking the quote.
 */
export function routeDistanceKm(fromName, toName) {
  const road = roadDistanceKm(fromName, toName)
  if (road != null) return Math.max(1, Math.round(road))

  const a = placeByName(fromName)
  const b = placeByName(toName)
  if (!a || !b) return null
  const km = haversineKm(a, b) * 1.35
  return Math.max(1, Math.round(km))
}

/** How far the driver has to come to reach the pickup. */
export function distanceFromBaseKm(baseName, pickupName) {
  return routeDistanceKm(baseName, pickupName) ?? 0
}
