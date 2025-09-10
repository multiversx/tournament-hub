import React from 'react';

interface MultiversXLogoProps {
    size?: number;
    showText?: boolean;
    className?: string;
}

export const MultiversXLogo: React.FC<MultiversXLogoProps> = ({
    size = 24,
    showText = true,
    className
}) => {
    const textSize = size * 0.6; // Scale text relative to icon size
    const xSize = size * 0.4; // Scale X symbol relative to text

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            {showText && (
                <span
                    className="font-bold text-white"
                    style={{ fontSize: `${textSize}px` }}
                >
                    Multivers
                </span>
            )}
            <svg
                width={xSize}
                height={xSize}
                viewBox="0 0 24 24"
                fill="none"
            >
                {/* MultiversX X Symbol - two intersecting bars */}
                <g>
                    {/* Top-left to bottom-right bar */}
                    <rect
                        x="4"
                        y="4"
                        width="16"
                        height="4"
                        rx="2"
                        ry="2"
                        transform="rotate(45 12 12)"
                        fill="#00D4AA"
                    />
                    {/* Top-right to bottom-left bar */}
                    <rect
                        x="4"
                        y="4"
                        width="16"
                        height="4"
                        rx="2"
                        ry="2"
                        transform="rotate(-45 12 12)"
                        fill="#00D4AA"
                    />
                </g>
            </svg>
        </div>
    );
};

export default MultiversXLogo;
