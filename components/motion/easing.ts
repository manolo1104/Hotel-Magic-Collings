// Curvas de easing a medida (espejo de los tokens CSS en globals.css).
// Más fuertes que las nativas — dan intención al movimiento (filosofía Emil).
type Bezier = [number, number, number, number];

export const EASE_OUT: Bezier = [0.23, 1, 0.32, 1];
export const EASE_IN_OUT: Bezier = [0.77, 0, 0.175, 1];
export const EASE_DRAWER: Bezier = [0.32, 0.72, 0, 1];
