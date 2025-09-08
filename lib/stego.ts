// // src/lib/stego.ts
// const MAGIC = new Uint8Array([0x53, 0x54, 0x45, 0x47]); // "STEG"

// export async function embedLSBIntoImageFile(
//   file: File,
//   message: string
// ): Promise<File> {
//   if (!message?.length) return file;

//   const img = await fileToImage(file);
//   const { canvas, ctx } = imageToCanvas(img);
//   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//   const data = imageData.data; // RGBA

//   const enc = new TextEncoder();
//   const msgBytes = enc.encode(message);
//   const msgLen = msgBytes.length;

//   // Build bitstream: MAGIC (4 bytes) + length (4 bytes, big-endian) + payload
//   const bitStream: number[] = [];
//   // MAGIC
//   for (const b of MAGIC) pushByteBits(bitStream, b);
//   // Length (32-bit big-endian)
//   for (let i = 3; i >= 0; i--) {
//     const b = (msgLen >> (i * 8)) & 0xff;
//     pushByteBits(bitStream, b);
//   }
//   // Payload
//   for (const b of msgBytes) pushByteBits(bitStream, b);

//   // Capacity check: 3 bits per pixel (RGB only, skip alpha)
//   const bitsAvailable = Math.floor((data.length / 4) * 3);
//   if (bitStream.length > bitsAvailable) {
//     throw new Error(
//       `Message too large. Need ${bitStream.length} bits but only ${bitsAvailable} bits available.`
//     );
//   }

//   // Embed into RGB channels
//   let bitIndex = 0;
//   for (let i = 0; i < data.length && bitIndex < bitStream.length; i++) {
//     if (i % 4 === 3) continue; // skip alpha
//     const bit = bitStream[bitIndex++];
//     data[i] = (data[i] & 0xfe) | bit; // set LSB
//   }

//   ctx.putImageData(imageData, 0, 0);

//   // Export as PNG (lossless) to preserve LSBs
//   const stegoBlob: Blob = await new Promise((res) =>
//     canvas.toBlob((b) => res(b as Blob), 'image/png')
//   );
//   const newName = file.name.replace(/\.[^.]+$/, '') + '-stego.png';
//   return new File([stegoBlob], newName, { type: 'image/png' });
// }

// export async function extractLSBFromImageURL(url: string): Promise<string> {
//   const img = await urlToImage(url);
//   const { canvas, ctx } = imageToCanvas(img);
//   const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

//   // Helper to read N bits from RGB LSB stream
//   let whichBit = 0;
//   const readBits = (count: number) => {
//     let val = 0;
//     for (let k = 0; k < count; k++) {
//       const { bit } = nextRGBBit(data, whichBit++);
//       val = (val << 1) | bit;
//     }
//     return val;
//   };

//   // Read MAGIC (4 bytes)
//   const readMagic = new Uint8Array(4);
//   for (let i = 0; i < 4; i++) readMagic[i] = readBits(8);
//   if (!equalUint8(readMagic, MAGIC)) {
//     throw new Error('No hidden message detected in this image.');
//   }

//   // Read length (4 bytes, big-endian)
//   const lenBytes = new Uint8Array(4);
//   for (let i = 0; i < 4; i++) lenBytes[i] = readBits(8);
//   const msgLen =
//     (lenBytes[0] << 24) |
//     (lenBytes[1] << 16) |
//     (lenBytes[2] << 8) |
//     lenBytes[3];

//   if (msgLen < 0 || msgLen > 50_000_000) {
//     // Basic sanity limit
//     throw new Error('Hidden message length is invalid.');
//   }

//   const msg = new Uint8Array(msgLen);
//   for (let i = 0; i < msgLen; i++) msg[i] = readBits(8);
//   return new TextDecoder().decode(msg);
// }

// // ---------- helpers ----------
// function pushByteBits(arr: number[], byte: number) {
//   for (let i = 7; i >= 0; i--) arr.push((byte >> i) & 1);
// }

// function imageToCanvas(img: HTMLImageElement) {
//   const canvas = document.createElement('canvas');
//   canvas.width = img.naturalWidth || img.width;
//   canvas.height = img.naturalHeight || img.height;
//   const ctx = canvas.getContext('2d')!;
//   ctx.drawImage(img, 0, 0);
//   return { canvas, ctx };
// }

// function equalUint8(a: Uint8Array, b: Uint8Array) {
//   if (a.length !== b.length) return false;
//   for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
//   return true;
// }

// function fileToImage(file: File): Promise<HTMLImageElement> {
//   return new Promise((resolve, reject) => {
//     const url = URL.createObjectURL(file);
//     const img = new Image();
//     img.onload = () => {
//       URL.revokeObjectURL(url);
//       resolve(img);
//     };
//     img.onerror = reject;
//     img.src = url;
//   });
// }

// // Robustly load cross-origin images for canvas
// async function urlToImage(url: string): Promise<HTMLImageElement> {
//   // Fetch the image as a blob to avoid CORS-tainted canvas
//   const resp = await fetch(url, { mode: 'cors' });
//   if (!resp.ok) throw new Error('Failed to fetch image for extraction.');
//   const blob = await resp.blob();
//   const objURL = URL.createObjectURL(blob);
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.onload = () => {
//       URL.revokeObjectURL(objURL);
//       resolve(img);
//     };
//     img.onerror = reject;
//     img.src = objURL;
//   });
// }

// function nextRGBBit(data: Uint8ClampedArray, whichBit: number) {
//   // Each pixel -> 3 bits (R,G,B). Ignore alpha.
//   const pixelIndex = Math.floor(whichBit / 3);
//   const within = whichBit % 3; // 0->R, 1->G, 2->B
//   const dataIndex = pixelIndex * 4 + within;
//   const bit = data[dataIndex] & 1;
//   return { bit, dataIndex };
// }

// src/lib/stego.ts
const MAGIC = new Uint8Array([0x53, 0x54, 0x45, 0x47]); // "STEG"

export async function embedLSBIntoImageFile(
  file: File,
  message: string
): Promise<File> {
  if (!message?.length) return file;

  const img = await fileToImage(file);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const enc = new TextEncoder();
  const msgBytes = enc.encode(message);
  const bitStream: number[] = [];

  // MAGIC
  for (const b of MAGIC) pushByteBits(bitStream, b);
  // length (big-endian 32-bit)
  const len = msgBytes.length;
  for (let i = 3; i >= 0; i--) pushByteBits(bitStream, (len >> (i * 8)) & 0xff);
  // payload
  for (const b of msgBytes) pushByteBits(bitStream, b);

  const bitsAvailable = Math.floor((data.length / 4) * 3);
  if (bitStream.length > bitsAvailable) {
    throw new Error(
      `Message too large for this image (need ${bitStream.length} bits, have ${bitsAvailable}).`
    );
  }

  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < bitStream.length; i++) {
    if (i % 4 === 3) continue; // skip alpha
    const bit = bitStream[bitIndex++];
    data[i] = (data[i] & 0xfe) | bit;
  }

  ctx.putImageData(imageData, 0, 0);

  const stegoBlob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b as Blob), 'image/png')
  );
  const newName = file.name.replace(/\.[^.]+$/, '') + '-stego.png';
  return new File([stegoBlob], newName, { type: 'image/png' });
}

export async function extractLSBFromImageURL(url: string): Promise<string> {
  const img = await urlToImage(url);
  const { canvas, ctx } = imageToCanvas(img);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return extractFromData(data);
}

export async function extractLSBFromFile(file: File): Promise<string> {
  const img = await fileToImage(file);
  const { canvas, ctx } = imageToCanvas(img);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return extractFromData(data);
}

// ---------- internals ----------
function extractFromData(data: Uint8ClampedArray): string {
  let whichBit = 0;
  const readBits = (n: number) => {
    let val = 0;
    for (let i = 0; i < n; i++) {
      const { bit } = nextRGBBit(data, whichBit++);
      val = (val << 1) | bit;
    }
    return val;
  };

  const readMagic = new Uint8Array(4);
  for (let i = 0; i < 4; i++) readMagic[i] = readBits(8);
  if (!equalUint8(readMagic, MAGIC))
    throw new Error('No hidden message detected in this image.');

  const lenBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) lenBytes[i] = readBits(8);
  const msgLen =
    (lenBytes[0] << 24) |
    (lenBytes[1] << 16) |
    (lenBytes[2] << 8) |
    lenBytes[3];

  if (msgLen < 0 || msgLen > 50_000_000)
    throw new Error('Hidden message length is invalid.');

  const msg = new Uint8Array(msgLen);
  for (let i = 0; i < msgLen; i++) msg[i] = readBits(8);
  return new TextDecoder().decode(msg);
}

function pushByteBits(arr: number[], byte: number) {
  for (let i = 7; i >= 0; i--) arr.push((byte >> i) & 1);
}
function imageToCanvas(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx };
}
function equalUint8(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}
async function urlToImage(url: string): Promise<HTMLImageElement> {
  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) throw new Error('Failed to fetch image for extraction.');
  const blob = await resp.blob();
  const objURL = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objURL);
      resolve(img);
    };
    img.onerror = reject;
    img.src = objURL;
  });
}
function nextRGBBit(data: Uint8ClampedArray, whichBit: number) {
  const pixelIndex = Math.floor(whichBit / 3);
  const within = whichBit % 3; // 0 R, 1 G, 2 B
  const dataIndex = pixelIndex * 4 + within;
  const bit = data[dataIndex] & 1;
  return { bit, dataIndex };
}
