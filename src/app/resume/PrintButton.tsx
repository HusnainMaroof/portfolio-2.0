'use client';

import { pill } from '@/lib/pill';

/** Opens the browser's print dialog, where "Save as PDF" gives a PDF copy. */
const PrintButton = () => (
    <button
        type="button"
        onClick={() => window.print()}
        className={pill(true, 'h-11 px-6 text-sm font-medium print:hidden')}
    >
        Save as PDF
    </button>
);

export default PrintButton;
