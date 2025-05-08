import { Color } from '../../../../lib/speedscope-core/color.ts'
import type { FlamegraphTheme } from '../theme.tsx'

// Fire theme (DARK) HCL constants
const H_MIN = 5.0;   // Start at clearer red
const H_RANGE = 40.0; // End in yellow (10+50=60)
const H_WIGGLE = 5.0; // Keep hue wiggle

const C_BASE = 0.58;  // Reduced saturation for dark
const C_VAR  = 0.03;  // Keep low chroma wiggle

const L_BASE = 0.20;  // Raised base luma slightly from previous dark
const L_VAR  = 0.09;  // Keep low luma wiggle

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
}

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

export const fireFlamegraphThemeDark: FlamegraphTheme = {
  colorForBucket,
  colorForBucketGLSL,
  flamegraphTextColor: '#FFFFFF',
}; 