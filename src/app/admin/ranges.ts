/** Dashboard time ranges. Plain module: shared by the server page and client controls. */
export const RANGES = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'all', label: 'All time' },
] as const;

export type RangeValue = (typeof RANGES)[number]['value'];
