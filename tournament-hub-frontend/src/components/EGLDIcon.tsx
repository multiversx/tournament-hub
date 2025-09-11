import React from 'react';

interface EGLDIconProps {
    size?: number;
    color?: string;
    className?: string;
}

export const EGLDIcon: React.FC<EGLDIconProps> = ({
    size = 16,
    color = "#00D4AA", // EGLD's signature cyan color
    className
}) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
        >
            {/* EGLD X Symbol - two intersecting bars */}
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
                    fill={color}
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
                    fill={color}
                />
            </g>
        </svg>
    );
};

export default EGLDIcon;
