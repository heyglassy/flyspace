import EventEmitter from "events";

export type ScreencastFramePayload = {
  /**
   * Base64-encoded compressed image.
   */
  data: string;
  /**
   * Screencast frame metadata.
   */
  metadata: {
    /**
     * Top offset in DIP.
     */
    offsetTop: number;
    /**
     * Page scale factor.
     */
    pageScaleFactor: number;
    /**
     * Device screen width in DIP.
     */
    deviceWidth: number;
    /**
     * Device screen height in DIP.
     */
    deviceHeight: number;
    /**
     * Position of horizontal scroll in CSS pixels.
     */
    scrollOffsetX: number;
    /**
     * Position of vertical scroll in CSS pixels.
     */
    scrollOffsetY: number;
    /**
     * Frame swap timestamp.
     */
    timestamp?: number;
  };
  /**
   * Frame number.
   */
  sessionId: number;
};

export class CDPEventEmitter extends EventEmitter {
  constructor() {
    super();
  }

  emit(eventName: "frame", event: ScreencastFramePayload) {
    return super.emit(eventName, event);
  }

  on(eventName: "frame", listener: (event: ScreencastFramePayload) => void) {
    return super.on(eventName, listener);
  }
}
