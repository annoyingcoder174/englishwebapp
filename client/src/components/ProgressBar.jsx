import React from "react";

/**
 * Simple accessible progress bar.
 * Props:
 *  - value: number 0..1
 *  - label: string (visually hidden for a11y)
 */
export default function ProgressBar({ value = 0, label = "Tiến độ" }) {
    const pct = Math.max(0, Math.min(1, value)) * 100;
    return (
        <div
            className="w-full h-2 bg-gray-200/70 dark:bg-gray-800/70 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
        >
            <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}
