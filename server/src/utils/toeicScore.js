// Rough TOEIC scaled score mapping. Replace with your preferred tables later.
// Input: raw correct (0..100), Output: scaled 5..495 (multiples of 5)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function scaleListening(raw) {
    // Simple piecewise approximation for demo
    if (raw <= 5) return 5;
    if (raw >= 95) return 495;
    // linear-ish ramp
    const scaled = 5 + Math.round((raw / 100) * 490 / 5) * 5;
    return clamp(scaled, 5, 495);
}

function scaleReading(raw) {
    if (raw <= 5) return 5;
    if (raw >= 95) return 495;
    const scaled = 5 + Math.round((raw / 100) * 490 / 5) * 5;
    return clamp(scaled, 5, 495);
}

export function toToeicScaled(listeningCorrect, readingCorrect) {
    return {
        listeningScaled: scaleListening(listeningCorrect),
        readingScaled: scaleReading(readingCorrect),
        totalScaled: clamp(scaleListening(listeningCorrect) + scaleReading(readingCorrect), 10, 990),
    };
}
