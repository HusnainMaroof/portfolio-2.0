import { ImageResponse } from 'next/og';

export const alt = 'Husnain Maroof — Full-Stack Developer (Next.js, React)';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 72,
                    backgroundColor: '#212121',
                    color: '#DEDEDE',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        fontSize: 28,
                        letterSpacing: 4,
                        textTransform: 'uppercase',
                        color: '#9CA3AF',
                    }}
                >
                    <span
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9999,
                            backgroundColor: '#00F050',
                            display: 'block',
                        }}
                    />
                    Full-Stack Developer · Islamabad, Pakistan
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 24,
                    }}
                >
                    <div
                        style={{
                            fontSize: 104,
                            fontWeight: 700,
                            color: '#FFFFFF',
                            lineHeight: 1,
                        }}
                    >
                        Husnain Maroof
                    </div>
                    <div style={{ fontSize: 36, color: '#9CA3AF' }}>
                        Fast, polished web apps with Next.js, React,
                        TypeScript &amp; Node.js
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 28,
                        color: '#00F050',
                    }}
                >
                    <span>Selected Projects</span>
                    <span>husnain.cc</span>
                </div>
            </div>
        ),
        { ...size },
    );
}
