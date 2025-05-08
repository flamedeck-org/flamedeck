import { Color } from '../../../../lib/speedscope-core/color.ts';
import type { FlamegraphTheme } from '../theme.tsx';

// Ice theme HCL constants
// Adjusted for a darker background
const H_MIN = 20.0; // Deeper red/orange start
const H_RANGE = 80.0; // Up to orange-yellow
const H_WIGGLE = 20.0; // Local hue wiggle for variety

const C_BASE = 0.15; // Slightly lower base chroma for dark mode
const C_VAR = 0.12; // Chroma wiggle

const L_BASE = 0.7; // Lower base luma for dark mode
const L_VAR = 0.05; // Smaller luma wiggle for dark mode

// Triangle wave helper (JS)
function triangle(x: number): number {
  const fract = x - Math.floor(x);
  return 2.0 * Math.abs(fract - 0.5);
}

const colorForBucket = (t: number): Color => {
  const clampedT = Math.max(0, Math.min(1, t));
  const x = triangle(30.0 * clampedT);

  // Hue gets a linear component plus extra wiggle based on x
  const H = H_MIN + H_RANGE * clampedT + H_WIGGLE * (x - 0.5);
  const C = C_BASE + C_VAR * (x - 0.5) * 2.0;
  const L = L_BASE + L_VAR * (0.5 - x); // brighter near peaks of triangle

  return Color.fromLumaChromaHue(L, C, H);
};

// GLSL version mirroring the same maths (uses triangle() from main shader)
const colorForBucketGLSL = `
vec3 colorForBucket(float t) {
  float clampedT = clamp(t, 0.0, 1.0);
  float x = triangle(30.0 * clampedT);

  float H = ${H_MIN.toFixed(1)} + ${H_RANGE.toFixed(1)} * clampedT + ${H_WIGGLE.toFixed(1)} * (x - 0.5);
  float C = ${C_BASE.toFixed(2)} + ${C_VAR.toFixed(2)} * (x - 0.5) * 2.0;
  float L = ${L_BASE.toFixed(2)} + ${L_VAR.toFixed(2)} * (0.5 - x);

  // hcl2rgb expects H in degrees, C & L in 0-1 range
  return hcl2rgb(H, C, L);
}
`;

// Exported as iceFlamegraphThemeLight
export const iceFlamegraphThemeLight: FlamegraphTheme = {
  colorForBucket,
  colorForBucketGLSL,
  flamegraphTextColor: '#000000',
};
