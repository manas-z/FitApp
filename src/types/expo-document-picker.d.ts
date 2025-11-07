declare module 'expo-document-picker' {
  export type DocumentPickerAsset = {
    uri: string;
    name?: string | null;
    size?: number | null;
    mimeType?: string | null;
  };

  export type DocumentPickerOptions = {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  };

  export type DocumentPickerSuccessResult = {
    canceled: false;
    assets: DocumentPickerAsset[];
  };

  export type DocumentPickerCanceledResult = {
    canceled: true;
    assets?: undefined;
  };

  export type DocumentPickerResult =
    | DocumentPickerSuccessResult
    | DocumentPickerCanceledResult;

  export function getDocumentAsync(
    options?: DocumentPickerOptions,
  ): Promise<DocumentPickerResult>;
}
