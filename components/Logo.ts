// components/Logo.ts
export function Logo() {
    return `
    <svg viewBox="0 0 205 40" class="h-8 w-auto" xmlns="http://www.w3.org/2000/svg" aria-label="WorkInOne">
        <style>
            .font-style { font-family: 'Inter', sans-serif; font-size: 32px; font-weight: 800; }
            .logo-dark-fill { fill: #2E6C80; }
            .logo-light-fill { fill: #5AB6D1; }
            .dark .logo-dark-fill { fill: #5AB6D1; }
            .dark .logo-light-fill { fill: #2E6C80; }
        </style>

        <g class="font-style">
            <!-- Background Layer -->
            <text x="0" y="32" class="logo-light-fill">W</text>
            <text x="33" y="32" class="logo-light-fill">o</text>
            <text x="53" y="32" class="logo-light-fill">r</text>
            <text x="68" y="32" class="logo-light-fill">k</text>
            <text x="88" y="32" class="logo-dark-fill">I</text>
            <text x="98" y="32" class="logo-light-fill">n</text>
            <!-- O is aperture -->
            <text x="155" y="32" class="logo-dark-fill">n</text>
            <text x="175" y="32" class="logo-dark-fill">e</text>

            <!-- Foreground Layer with Clipping -->
            <g>
                <defs>
                    <clipPath id="clip-W"><path d="M0,0 H18 L2,40 H-10 Z"/></clipPath>
                    <clipPath id="clip-o"><path d="M33,0 H53 L53,15 H33 Z"/></clipPath>
                    <clipPath id="clip-r"><path d="M53,0 H68 L68,15 H53 Z"/></clipPath>
                    <clipPath id="clip-k"><path d="M68,0 H88 L88,15 H68 Z"/></clipPath>
                    <clipPath id="clip-e"><path d="M175,0 H195 L195,15 H175 Z"/></clipPath>
                </defs>
                <text x="0" y="32" class="logo-dark-fill" clip-path="url(#clip-W)">W</text>
                <text x="33" y="32" class="logo-dark-fill" clip-path="url(#clip-o)">o</text>
                <text x="53" y="32" class="logo-dark-fill" clip-path="url(#clip-r)">r</text>
                <text x="68" y="32" class="logo-dark-fill" clip-path="url(#clip-k)">k</text>
                <text x="175" y="32" class="logo-light-fill" clip-path="url(#clip-e)">e</text>
            </g>
        </g>
        
        <!-- Aperture 'O' -->
        <g transform="translate(130 20)" class="logo-light-fill">
            <path d="M0 -15 A15 15 0 0 1 13 -7.5 L6.5 -3.75 A7.5 7.5 0 0 0 0 -7.5 Z"></path>
            <path transform="rotate(60)" d="M0 -15 A15 15 0 0 1 13 -7.5 L6.5 -3.75 A7.5 7.5 0 0 0 0 -7.5 Z"></path>
            <path transform="rotate(120)" d="M0 -15 A15 15 0 0 1 13 -7.5 L6.5 -3.75 A7.5 7.5 0 0 0 0 -7.5 Z"></path>
            <path transform="rotate(180)" d="M0 -15 A15 15 0 0 1 13 -7.5 L6.5 -3.75 A7.5 7.5 0 0 0 0 -7.5 Z"></path>
            <path transform="rotate(240)" d="M0 -15 A15 15 0 0 1 13 -7.5 L6.5 -3.75 A7.5 7.5 0 0 0 0 -7.5 Z"></path>
            <path transform="rotate(300)" d="M0 -15 A15 15 0 0 1 13 -7.5 L6.5 -3.75 A7.5 7.5 0 0 0 0 -7.5 Z"></path>
        </g>
    </svg>
    `;
}
