declare module 'mammoth/mammoth.browser.js' {
  interface MammothMessage {
    type: string;
    message: string;
  }

  interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: { styleMap?: string[] }): Promise<MammothResult>;
  };

  export default mammoth;
}
