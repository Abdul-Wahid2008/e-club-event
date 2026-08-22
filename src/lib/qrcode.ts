/**
 * Minimal, dependency-free QR Code encoder (byte mode only).
 *
 * Ported and trimmed from "qrcode-generator" by Kazuhiko Arase, MIT License:
 * https://github.com/kazuhikoarase/qrcode-generator
 * Original copyright (c) 2009 Kazuhiko Arase, released under the MIT license.
 * Trimmed here to byte-mode encoding, auto version selection, and the four
 * standard error-correction levels — everything needed to encode a URL and
 * render it as an inline SVG, with no runtime CDN dependency.
 */

type ECLevel = 'L' | 'M' | 'Q' | 'H';

const EC_LEVEL_MAP: Record<ECLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

const G15 = 0b1010011011111;
const G18 = 0b1111100100101101;
const G15_MASK = 0b101010000010010;

function getBCHDigit(data: number): number {
  let digit = 0;
  while (data !== 0) {
    digit++;
    data >>>= 1;
  }
  return digit;
}

function getBCHTypeInfo(data: number): number {
  let d = data << 10;
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

function getBCHTypeNumber(data: number): number {
  let d = data << 12;
  while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
    d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
  }
  return (data << 12) | d;
}

// --- Galois Field math for Reed-Solomon error correction ---
const EXP_TABLE = new Array<number>(256);
const LOG_TABLE = new Array<number>(256);
for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] =
    EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

function gexp(n: number): number {
  let x = n;
  while (x < 0) x += 255;
  while (x >= 256) x -= 255;
  return EXP_TABLE[x];
}
function glog(n: number): number {
  if (n < 1) throw new Error('glog(' + n + ')');
  return LOG_TABLE[n];
}

class Polynomial {
  num: number[];
  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift).fill(0);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  get(index: number) {
    return this.num[index];
  }
  get length() {
    return this.num.length;
  }
  multiply(e: Polynomial): Polynomial {
    const num = new Array(this.length + e.length - 1).fill(0);
    for (let i = 0; i < this.length; i++) {
      for (let j = 0; j < e.length; j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new Polynomial(num);
  }
  mod(e: Polynomial): Polynomial {
    if (this.length - e.length < 0) return this;
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = [...this.num];
    for (let i = 0; i < e.length; i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new Polynomial(num).mod(e);
  }
}

function getErrorCorrectPolynomial(errorCorrectLength: number): Polynomial {
  let a = new Polynomial([1]);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new Polynomial([1, gexp(i)]));
  }
  return a;
}

// RS block table subset (byte mode, versions 1-10 which comfortably fit a
// short URL at levels L/M/Q). [totalCount, dataCount] per EC level per version.
// Values from the QR spec (ISO/IEC 18004), same table used by the reference impl.
const RS_BLOCK_TABLE: Record<number, Record<ECLevel, [number, number][]>> = {
  1: { L: [[26, 19]], M: [[26, 16]], Q: [[26, 13]], H: [[26, 9]] },
  2: { L: [[44, 34]], M: [[44, 28]], Q: [[44, 22]], H: [[44, 16]] },
  3: { L: [[70, 55]], M: [[70, 44]], Q: [[35, 17], [35, 18]], H: [[35, 13], [35, 13]] },
  4: { L: [[100, 80]], M: [[50, 32], [50, 32]], Q: [[50, 24], [50, 25]], H: [[25, 9], [25, 9], [25, 10], [25, 10]] },
  5: { L: [[134, 108]], M: [[67, 43], [67, 43]], Q: [[33, 15], [33, 16], [33, 16], [33, 16]], H: [[33, 11], [33, 11], [33, 12], [33, 12]] },
  6: { L: [[86, 68], [86, 68]], M: [[43, 27], [43, 27], [43, 27], [43, 27]], Q: [[43, 19], [43, 19], [43, 19], [43, 19]], H: [[43, 15], [43, 15], [43, 15], [43, 15]] },
  7: { L: [[98, 78], [98, 78]], M: [[49, 31], [49, 31], [49, 31], [49, 32]], Q: [[32, 14], [32, 14], [32, 14], [32, 15], [32, 15], [32, 15]], H: [[39, 13], [39, 13], [39, 13], [39, 13], [39, 14]] },
  8: { L: [[121, 97], [121, 97]], M: [[60, 38], [60, 38], [60, 39], [60, 39]], Q: [[40, 18], [40, 18], [40, 18], [40, 18], [40, 19], [40, 19]], H: [[40, 14], [40, 14], [40, 14], [40, 14], [40, 15], [40, 15], [40, 15], [40, 15]] },
  9: { L: [[146, 116]], M: [[65, 39], [65, 39], [65, 40], [65, 40], [65, 40], [65, 40]], Q: [[36, 16], [36, 16], [36, 16], [36, 16], [36, 17], [36, 17], [36, 17], [36, 17]], H: [[36, 12], [36, 12], [36, 12], [36, 13], [36, 13], [36, 13], [36, 13], [36, 13]] },
  10: { L: [[86, 68], [86, 68], [86, 69], [86, 69]], M: [[64, 40], [64, 40], [64, 41], [64, 41], [64, 41], [64, 41], [64, 41], [64, 41]], Q: [[43, 19], [43, 19], [43, 19], [43, 19], [43, 20], [43, 20], [43, 20], [43, 20], [43, 20], [43, 20]], H: [[43, 15], [43, 15], [43, 15], [43, 15], [43, 15], [43, 15], [43, 16], [43, 16], [43, 16], [43, 16], [43, 16]] },
};

const PAD0 = 0xec;
const PAD1 = 0x11;

class BitBuffer {
  buffer: number[] = [];
  length = 0;
  get(index: number) {
    return ((this.buffer[Math.floor(index / 8)] >>> (7 - (index % 8))) & 1) === 1;
  }
  put(num: number, length: number) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }
  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    this.length++;
  }
}

function stringToBytes(s: string): number[] {
  const bytes: number[] = [];
  const utf8 = unescape(encodeURIComponent(s));
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  return bytes;
}

function createBytes(buffer: BitBuffer, rsBlocks: [number, number][]) {
  let offset = 0;
  let maxDcCount = 0;
  let maxEcCount = 0;
  const dcdata: number[][] = [];
  const ecdata: number[][] = [];

  for (let r = 0; r < rsBlocks.length; r++) {
    const [totalCount, dataCount] = rsBlocks[r];
    const dcCount = dataCount;
    const ecCount = totalCount - dcCount;
    maxDcCount = Math.max(maxDcCount, dcCount);
    maxEcCount = Math.max(maxEcCount, ecCount);

    const dc = new Array(dcCount);
    for (let i = 0; i < dcCount; i++) {
      dc[i] = 0xff & buffer.buffer[i + offset];
    }
    offset += dcCount;

    const rsPoly = getErrorCorrectPolynomial(ecCount);
    const rawPoly = new Polynomial(dc, rsPoly.length - 1);
    const modPoly = rawPoly.mod(rsPoly);
    const ec = new Array(rsPoly.length - 1);
    for (let i = 0; i < ec.length; i++) {
      const modIndex = i + modPoly.length - ec.length;
      ec[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
    dcdata.push(dc);
    ecdata.push(ec);
  }

  const totalCodeCount = rsBlocks.reduce((sum, b) => sum + b[0], 0);
  const data = new Array(totalCodeCount);
  let index = 0;
  for (let i = 0; i < maxDcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < dcdata[r].length) data[index++] = dcdata[r][i];
    }
  }
  for (let i = 0; i < maxEcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < ecdata[r].length) data[index++] = ecdata[r][i];
    }
  }
  return data;
}

function getMaskFunction(maskPattern: number) {
  switch (maskPattern) {
    case 0: return (i: number, j: number) => (i + j) % 2 === 0;
    case 1: return (i: number) => i % 2 === 0;
    case 2: return (_i: number, j: number) => j % 3 === 0;
    case 3: return (i: number, j: number) => (i + j) % 3 === 0;
    case 4: return (i: number, j: number) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5: return (i: number, j: number) => ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6: return (i: number, j: number) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7: return (i: number, j: number) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default: throw new Error('bad maskPattern:' + maskPattern);
  }
}

const PATTERN_POSITION_TABLE: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
];

class QRModel {
  typeNumber: number;
  errorCorrectLevel: ECLevel;
  modules: (boolean | null)[][] = [];
  moduleCount = 0;
  dataCache: number[] | null = null;
  dataList: string;

  constructor(typeNumber: number, errorCorrectLevel: ECLevel, data: string) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.dataList = data;
  }

  isDark(row: number, col: number) {
    return !!this.modules[row][col];
  }

  make() {
    this.makeImpl(false, this.getBestMaskPattern());
  }

  private setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        const dark =
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4);
        this.modules[row + r][col + c] = dark;
      }
    }
  }

  private getBestMaskPattern() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i);
      const lostPoint = this.getLostPoint();
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  }

  private setupTiming() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  private setupPositionAdjustPattern() {
    const pos = PATTERN_POSITION_TABLE[this.typeNumber - 1] || [];
    for (const row of pos) {
      for (const col of pos) {
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const dark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
            this.modules[row + r][col + c] = dark;
          }
        }
      }
    }
  }

  private setupTypeNumber(test: boolean) {
    const bits = getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  private setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (EC_LEVEL_MAP[this.errorCorrectLevel] << 3) | maskPattern;
    const bits = getBCHTypeInfo(data);

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }

  private mapData(data: number[], maskPattern: number) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFn = getMaskFunction(maskPattern);

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            const mask = maskFn(row, col - c);
            if (mask) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  private getLostPoint() {
    const moduleCount = this.moduleCount;
    let lostPoint = 0;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        let sameCount = 0;
        const dark = this.isDark(row, col);
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || moduleCount <= row + r) continue;
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || moduleCount <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === this.isDark(row + r, col + c)) sameCount++;
          }
        }
        if (sameCount > 5) lostPoint += 3 + sameCount - 5;
      }
    }

    for (let row = 0; row < moduleCount - 1; row++) {
      for (let col = 0; col < moduleCount - 1; col++) {
        let count = 0;
        if (this.isDark(row, col)) count++;
        if (this.isDark(row + 1, col)) count++;
        if (this.isDark(row, col + 1)) count++;
        if (this.isDark(row + 1, col + 1)) count++;
        if (count === 0 || count === 4) lostPoint += 3;
      }
    }

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount - 6; col++) {
        if (
          this.isDark(row, col) && !this.isDark(row, col + 1) && this.isDark(row, col + 2) &&
          this.isDark(row, col + 3) && this.isDark(row, col + 4) && !this.isDark(row, col + 5) && this.isDark(row, col + 6)
        ) {
          lostPoint += 40;
        }
      }
    }
    for (let col = 0; col < moduleCount; col++) {
      for (let row = 0; row < moduleCount - 6; row++) {
        if (
          this.isDark(row, col) && !this.isDark(row + 1, col) && this.isDark(row + 2, col) &&
          this.isDark(row + 3, col) && this.isDark(row + 4, col) && !this.isDark(row + 5, col) && this.isDark(row + 6, col)
        ) {
          lostPoint += 40;
        }
      }
    }

    let darkCount = 0;
    for (let col = 0; col < moduleCount; col++) {
      for (let row = 0; row < moduleCount; row++) {
        if (this.isDark(row, col)) darkCount++;
      }
    }
    const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;

    return lostPoint;
  }

  private makeImpl(test: boolean, maskPattern: number) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = Array.from({ length: this.moduleCount }, () =>
      new Array(this.moduleCount).fill(null)
    );

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTiming();
    this.setupTypeInfo(test, maskPattern);
    if (this.typeNumber >= 7) this.setupTypeNumber(test);

    if (this.dataCache == null) {
      this.dataCache = this.createData();
    }
    this.mapData(this.dataCache, maskPattern);
  }

  private createData(): number[] {
    const rsBlocks = RS_BLOCK_TABLE[this.typeNumber][this.errorCorrectLevel];
    const buffer = new BitBuffer();
    const bytes = stringToBytes(this.dataList);

    // Byte mode (0100), 8-bit char count (versions 1-9), then raw bytes.
    buffer.put(4, 4);
    buffer.put(bytes.length, this.typeNumber < 10 ? 8 : 16);
    for (const b of bytes) buffer.put(b, 8);

    const totalDataCount = rsBlocks.reduce((sum, b) => sum + b[1], 0);
    if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);

    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(PAD0, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(PAD1, 8);
    }

    return createBytes(buffer, rsBlocks);
  }
}

function fitsInVersion(typeNumber: number, level: ECLevel, byteLength: number): boolean {
  const rsBlocks = RS_BLOCK_TABLE[typeNumber]?.[level];
  if (!rsBlocks) return false;
  const totalDataCount = rsBlocks.reduce((sum, b) => sum + b[1], 0);
  // header(4 bits) + length field(8 or 16 bits) + payload, rounded to bytes
  const headerBits = 4 + (typeNumber < 10 ? 8 : 16);
  const neededBits = headerBits + byteLength * 8;
  return neededBits <= totalDataCount * 8;
}

/**
 * Encodes `text` as a QR code and returns a boolean matrix (true = dark
 * module). Automatically picks the smallest version (1-10) that fits at the
 * requested error-correction level, which is plenty for a portal URL.
 */
export function encodeQR(text: string, level: ECLevel = 'M'): boolean[][] {
  const byteLength = stringToBytes(text).length;
  let typeNumber = 10;
  for (let v = 1; v <= 10; v++) {
    if (fitsInVersion(v, level, byteLength)) {
      typeNumber = v;
      break;
    }
  }

  const qr = new QRModel(typeNumber, level, text);
  qr.make();

  const matrix: boolean[][] = [];
  for (let r = 0; r < qr.moduleCount; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < qr.moduleCount; c++) {
      row.push(qr.isDark(r, c));
    }
    matrix.push(row);
  }
  return matrix;
}
