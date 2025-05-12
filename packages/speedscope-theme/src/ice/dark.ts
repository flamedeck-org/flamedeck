import { Color } from '@flamedeck/speedscope-core/color';
import type { FlamegraphTheme } from '../types';

// Ice theme (DARK) HCL constants
// Adjusted for a darker background
const H_MIN = 20.0; // Deeper red/orange start
const H_RANGE = 80.0; // Up to orange-yellow
const H_WIGGLE = 20.0; // Local hue wiggle for variety

const C_BASE = 0.15; // Slightly lower base chroma for dark mode
const C_VAR = 0.12; // Chroma wiggle

const L_BASE = 0.2; // Lower base luma for dark mode
const L_VAR = 0.05; // Smaller luma wiggle for dark mode

// Triangle wave helper (JS)
function triangle(x: number): number {
  const fract = x - Math.floor(x);
  return 2.0 * Math.abs(fract - 0.5);
}

const colorForBucket = (t: number): Color => {
  const clampedT = Math.max(0, Math.min(1, t));
  const x = triangle(30.0 * clampedT);

  const H = H_MIN + H_RANGE * clampedT + H_WIGGLE * (x - 0.5);
  const C = C_BASE + C_VAR * (x - 0.5) * 2.0;
  const L = L_BASE + L_VAR * (0.5 - x);

  return Color.fromLumaChromaHue(L, C, H);
};

// GLSL version
const colorForBucketGLSL = `
vec3 colorForBucket(float t) {
  float clampedT = clamp(t, 0.0, 1.0);
  float x = triangle(30.0 * clampedT);

  float H = ${H_MIN.toFixed(1)} + ${H_RANGE.toFixed(1)} * clampedT + ${H_WIGGLE.toFixed(1)} * (x - 0.5);
  float C = ${C_BASE.toFixed(2)} + ${C_VAR.toFixed(2)} * (x - 0.5) * 2.0;
  float L = ${L_BASE.toFixed(2)} + ${L_VAR.toFixed(2)} * (0.5 - x);

  return hcl2rgb(H, C, L);
}
`;

export const iceFlamegraphThemeDark: FlamegraphTheme = {
  colorForBucket,
  colorForBucketGLSL,
  flamegraphTextColor: '#FFFFFF',
};
