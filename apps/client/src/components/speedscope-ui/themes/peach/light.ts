import { Color } from '../../../../lib/speedscope-core/color.ts'
import { FlamegraphTheme } from '../theme.tsx'

// Peach theme HCL constants (0-1 scale for C & L, degrees for H)
// These values produce a peach/orange/yellow palette
const H_MIN = 5.0;    // Deeper red/orange start
const H_RANGE = 40.0; // Up to orange-yellow
const H_WIGGLE = 10.0; // Local hue wiggle for variety

const C_BASE = 0.90;  // Strong chroma base
const C_VAR  = 0.08;  // More chroma wiggle

const L_BASE = 0.55;  // Base luma
const L_VAR  = 0.25;  // Larger luma wiggle

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
}

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

// Exported as peachFlamegraphThemeLight
export const peachFlamegraphThemeLight: FlamegraphTheme = {
  colorForBucket,
  colorForBucketGLSL,
}; 