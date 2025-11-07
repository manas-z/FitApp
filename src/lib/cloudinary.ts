import Constants from 'expo-constants';

export type CloudinaryResourceType = 'image' | 'video' | 'auto';

export interface CloudinaryUploadAsset {
  uri: string;
  mimeType?: string | null;
  name?: string | null;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  originalFilename?: string;
}

function getEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value) return value;
  }

  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return extra?.[key];
}

function assertConfig(value: string | undefined, key: string): asserts value is string {
  if (!value) {
    throw new Error(
      `Missing Cloudinary configuration for ${key}. Set ${key} as an EXPO_PUBLIC variable or inside expo.extra.`,
    );
  }
}

export async function uploadToCloudinary(
  asset: CloudinaryUploadAsset,
  resourceType: CloudinaryResourceType = 'auto',
): Promise<CloudinaryUploadResult> {
  const cloudName = getEnvVar('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  const uploadPreset = getEnvVar('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');

  assertConfig(cloudName, 'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  assertConfig(uploadPreset, 'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  const fileName = asset.name ?? `upload-${Date.now()}`;
  const mimeType = asset.mimeType ?? 'application/octet-stream';

  formData.append('file', {
    uri: asset.uri,
    type: mimeType,
    name: fileName,
  } as any);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as {
    secure_url: string;
    public_id: string;
    resource_type: string;
    original_filename?: string;
  };

  return {
    secureUrl: json.secure_url,
    publicId: json.public_id,
    resourceType: json.resource_type,
    originalFilename: json.original_filename,
  };
}
