// Thermometer answer: the warmth slider drawn as a thermometer (same range input, same 5 buckets).
import { mount as slider } from "./slider.js";

export const mount = (host, q) => slider(host, q, { thermo: true });
