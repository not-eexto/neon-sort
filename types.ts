export enum BarState {
  Idle = 'IDLE',
  Compare = 'COMPARE',
  Active = 'ACTIVE', // The key being inserted
  Sorted = 'SORTED',
  Overwrite = 'OVERWRITE' // When a value is being shifted/copied
}

export interface ArrayBar {
  value: number;
  state: BarState;
  id: number; // unique id for react keys
}

// Window augmentation for external libraries loaded via CDN
declare global {
  interface Window {
    GIF: any;
    html2canvas: any;
  }
}