// src/components/RegionPolygon.tsx
"use client";
import React, { useMemo } from "react";
import * as THREE from "three";
import { latLngToVector3 } from "../lib/geo";

type Props = {
  lat: number;
  lng: number;
  radiusKm?: number;     // circle radius in kilometers
  segments?: number;     // number of points in circle
  color?: string;
  globeRadius?: number;  // default globe radius used in Map3D (1.8)
  height?: number;       // how much above globe surface
  visible?: boolean;
  opacity?: number;
};

const EARTH_R_KM = 6371;

export default function RegionPolygon({
  lat,
  lng,
  radiusKm = 300,
  segments = 96,
  color = "#ffffff",
  globeRadius = 1.8,
  height = 0.02,
  visible = true,
  opacity = 0.75,
}: Props) {
  if (!visible) return null;

  // Precompute points of the small circle on the globe surface elevated by `height`
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    // convert radius km -> degrees approx (small-circle approximation)
    const radiusDeg = (radiusKm / EARTH_R_KM) * (180 / Math.PI);
    const latRad = (lat * Math.PI) / 180;

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const dLat = radiusDeg * Math.cos(theta);
      // adjust long offset by cos(lat)
      const dLng = radiusDeg * Math.sin(theta) / Math.cos(latRad || 1);
      const pLat = lat + dLat;
      const pLng = lng + dLng;
      const [x, y, z] = latLngToVector3(pLat, pLng, globeRadius + height);
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [lat, lng, radiusKm, segments, globeRadius, height]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [points]);

  const lineObject = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: 2,
      transparent: true,
      opacity,
    });
    const line = new THREE.Line(geom, material);
    line.renderOrder = 2;
    return line;
  }, [geom, color, opacity]);

  return <primitive object={lineObject} />;
}
