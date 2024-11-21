export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function mix(a: number[], b: number[], t: number) {
    return a.map((v, i) => lerp(v, b[i], t));
}

export function bilinearFilter(
    tl: number[],
    tr: number[],
    bl: number[],
    br: number[],
    t1: number,
    t2: number,
) {
    const t = mix(tl, tr, t1);
    const b = mix(bl, br, t1);
    return mix(t, b, t2);
}

export const createNextMipLevelRgba8Unorm = ({
    data: src,
    width: srcWidth,
    height: srcHeight,
}: {
    data: Uint8Array;
    width: number;
    height: number;
}) => {
    // compute the size of the next mip
    const dstWidth = Math.max(1, (srcWidth / 2) | 0);
    const dstHeight = Math.max(1, (srcHeight / 2) | 0);
    const dst = new Uint8Array(dstWidth * dstHeight * 4);

    const getSrcPixel = (x: number, y: number) => {
        const offset = (y * srcWidth + x) * 4;
        return src.subarray(offset, offset + 4);
    };

    for (let y = 0; y < dstHeight; ++y) {
        for (let x = 0; x < dstWidth; ++x) {
            // compute texcoord of the center of the destination texel
            const u = (x + 0.5) / dstWidth;
            const v = (y + 0.5) / dstHeight;

            // compute the same texcoord in the source - 0.5 a pixel
            const au = u * srcWidth - 0.5;
            const av = v * srcHeight - 0.5;

            // compute the src top left texel coord (not texcoord)
            const tx = au | 0;
            const ty = av | 0;

            // compute the mix amounts between pixels
            const t1 = au % 1;
            const t2 = av % 1;

            // get the 4 pixels
            const tl = getSrcPixel(tx, ty);
            const tr = getSrcPixel(tx + 1, ty);
            const bl = getSrcPixel(tx, ty + 1);
            const br = getSrcPixel(tx + 1, ty + 1);

            // copy the "sampled" result into the dest.
            const dstOffset = (y * dstWidth + x) * 4;
            // @ts-ignore
            dst.set(bilinearFilter(tl, tr, bl, br, t1, t2), dstOffset);
        }
    }
    return { data: dst, width: dstWidth, height: dstHeight };
};

export const generateMips = (src: Uint8Array, srcWidth: number) => {
    const srcHeight = src.length / 4 / srcWidth;

    // populate with first mip level (base level)
    let mip = { data: src, width: srcWidth, height: srcHeight };
    const mips = [mip];

    while (mip.width > 1 || mip.height > 1) {
        mip = createNextMipLevelRgba8Unorm(mip);
        mips.push(mip);
    }
    return mips;
};

export const createBlendedMipmap = () => {
    const w = [255, 255, 255, 255];
    const r = [255, 0, 0, 255];
    const b = [0, 28, 116, 255];
    const y = [255, 231, 0, 255];
    const g = [58, 181, 75, 255];
    const a = [38, 123, 167, 255];
    // prettier-ignore
    const data = new Uint8Array([
        w, r, r, r, r, r, r, a, a, r, r, r, r, r, r, w,
        w, w, r, r, r, r, r, a, a, r, r, r, r, r, w, w,
        w, w, w, r, r, r, r, a, a, r, r, r, r, w, w, w,
        w, w, w, w, r, r, r, a, a, r, r, r, w, w, w, w,
        w, w, w, w, w, r, r, a, a, r, r, w, w, w, w, w,
        w, w, w, w, w, w, r, a, a, r, w, w, w, w, w, w,
        w, w, w, w, w, w, w, a, a, w, w, w, w, w, w, w,
        b, b, b, b, b, b, b, b, a, y, y, y, y, y, y, y,
        b, b, b, b, b, b, b, g, y, y, y, y, y, y, y, y,
        w, w, w, w, w, w, w, g, g, w, w, w, w, w, w, w,
        w, w, w, w, w, w, r, g, g, r, w, w, w, w, w, w,
        w, w, w, w, w, r, r, g, g, r, r, w, w, w, w, w,
        w, w, w, w, r, r, r, g, g, r, r, r, w, w, w, w,
        w, w, w, r, r, r, r, g, g, r, r, r, r, w, w, w,
        w, w, r, r, r, r, r, g, g, r, r, r, r, r, w, w,
        w, r, r, r, r, r, r, g, g, r, r, r, r, r, r, w,
    ].flat());
    return generateMips(data, 16);
};

export const createCheckedMipmap = () => {
    const ctx = document
        .createElement("canvas")
        .getContext("2d", { willReadFrequently: true })!;
    const levels = [
        { size: 64, color: "rgb(128,0,255)" },
        { size: 32, color: "rgb(0,255,0)" },
        { size: 16, color: "rgb(255,0,0)" },
        { size: 8, color: "rgb(255,255,0)" },
        { size: 4, color: "rgb(0,0,255)" },
        { size: 2, color: "rgb(0,255,255)" },
        { size: 1, color: "rgb(255,0,255)" },
    ];
    return levels.map(({ size, color }, i) => {
        ctx.canvas.width = size;
        ctx.canvas.height = size;
        ctx.fillStyle = i & 1 ? "#000" : "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size / 2, size / 2);
        ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
        return ctx.getImageData(0, 0, size, size);
    });
};
