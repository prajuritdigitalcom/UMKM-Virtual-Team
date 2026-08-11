declare module 'mammoth/mammoth.browser' {
  export interface ExtractRawTextInput {
    arrayBuffer: ArrayBuffer;
  }

  export interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }

  interface MammothBrowser {
    extractRawText(input: ExtractRawTextInput): Promise<ExtractRawTextResult>;
  }

  const mammoth: MammothBrowser;
  export default mammoth;
}
