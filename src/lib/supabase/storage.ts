import { createClient, isSupabaseConfigured } from './client';

export async function uploadSignagePhoto(
  file: File | Blob,
  signageId: string,
  month: string
): Promise<{ path: string; url: string }> {
  const fileExt = 'jpg';
  const timestamp = Date.now();
  const filePath = `${signageId}/${month}_${timestamp}.${fileExt}`;

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from('signage-photos')
      .upload(filePath, file, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    // Generate signed URL for private bucket (valid for 1 hour)
    const { data: signedData } = await supabase.storage
      .from('signage-photos')
      .createSignedUrl(filePath, 3600);

    return {
      path: filePath,
      url: signedData?.signedUrl || filePath,
    };
  }

  // Fallback for Demo sandbox: Convert file to Base64 data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        path: filePath,
        url: reader.result as string,
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a signed URL for a photo stored in the private "signage-photos" bucket.
 * If the path is already a base64 string, blob, or external URL, it returns it directly.
 */
export async function getSignedPhotoUrl(
  pathOrUrl?: string | null,
  expiresIn = 3600
): Promise<string | null> {
  if (!pathOrUrl) return null;

  // Base64 or local blob URLs require no signing
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      let cleanPath = pathOrUrl;

      // Extract relative path if full URL was stored
      if (cleanPath.includes('/signage-photos/')) {
        cleanPath = cleanPath.split('/signage-photos/')[1];
      }
      // Remove any trailing query parameters
      cleanPath = cleanPath.split('?')[0];

      const { data, error } = await supabase.storage
        .from('signage-photos')
        .createSignedUrl(cleanPath, expiresIn);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }

      // If signed URL generation had an issue, fallback to public url if bucket was made public
      const { data: publicData } = supabase.storage
        .from('signage-photos')
        .getPublicUrl(cleanPath);

      return publicData?.publicUrl || pathOrUrl;
    } catch (e) {
      console.warn('Failed to generate signed URL for path:', pathOrUrl, e);
      return pathOrUrl;
    }
  }

  return pathOrUrl;
}
