import { GENERAL_INFO } from '@/lib/data';
import React from 'react';

/**
 * Bottom-left, under the centred nav rail and above the social links. Shown
 * only when the viewport is tall enough for all three to clear each other
 * (rail ~264px, email ~240px).
 */
const StickyEmail = () => {
    return (
        <div data-avatar-dock-gutter="" className="fixed bottom-24 right-[22px] z-[4] hidden">
            <a
                href={`mailto:${GENERAL_INFO.email}`}
                data-avatar="contact"
                className="block px-3 text-muted-foreground tracking-[1px] transition-all !bg-bottom hover:text-foreground hover:!bg-center"
                style={{
                    // background:
                    //     'linear-gradient(to bottom, hsl(var(--muted-foreground)) 0% 33.33%, hsl(var(--primary)) 33.33% 66.66%, hsl(var(--muted-foreground)) 66.66% 100%)',
                    // backgroundSize: '100% 300%',

                    // backgroundClip: 'text',
                    // color: 'transparent',

                    textOrientation: 'mixed',
                    writingMode: 'vertical-rl',
                }}
            >
                {GENERAL_INFO.email}
            </a>
        </div>
    );
};

export default StickyEmail;
