import * as THREE from "three";

export function coerce(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v == null || v === "") return v;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

export function readDataset(el) {
  const d = el.dataset;
  return {
    img: d.rgbImg || d.img || null,
    fallback: d.rgbFallback || null,
    maxW: Number(d.rgbMaxw ?? 1400),
    dpr: Number(d.rgbDpr ?? 2),
    bg: d.rgbBg || "#0b0b10",
    intensity: Number(d.rgbIntensity ?? 0.02),
    falloff: Number(d.rgbFalloff ?? 0.45),
    noiseFreq: Number(d.rgbNoiseFreq ?? 3.0),
    noiseSpeed: Number(d.rgbNoiseSpeed ?? 0.10),
    smoothing: Number(d.rgbSmoothing ?? 0.12),
    channels: (d.rgbChannels || "rgb").toLowerCase(), // rgb | rg | rb | gb | r | g | b
  };
}

export async function loadTexture(src, fallback) {
  const loader = new THREE.TextureLoader();
  const tryLoad = async (url) => {
    const tex = await loader.loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  try {
    return await tryLoad(src);
  } catch (e) {
    if (!fallback) throw e;
    console.warn("[RGB] Greška pri učitavanju, koristim fallback:", e);
    return await tryLoad(fallback);
  }
}

export function channelsToMix(ch) {
  // vrati vec3 koje kanale da zadrži/pojača (1=on, 0=off)
  switch (ch) {
    case "r":  return [1,0,0];
    case "g":  return [0,1,0];
    case "b":  return [0,0,1];
    case "rg": return [1,1,0];
    case "rb": return [1,0,1];
    case "gb": return [0,1,1];
    default:   return [1,1,1]; // "rgb"
  }
}
