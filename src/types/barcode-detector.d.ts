// Minimal typings for the native browser Shape Detection API "BarcodeDetector".
// Not yet part of TypeScript's built-in DOM lib, but shipped in Chrome/Edge/Android
// WebView. We feature-detect at runtime (`"BarcodeDetector" in window`) before use.

interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcodePoint {
  x: number;
  y: number;
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: DetectedBarcodePoint[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
