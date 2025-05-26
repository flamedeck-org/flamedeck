import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ImageGenerationResult {
    lightImagePath: string | null;
    darkImagePath: string | null;
}

export async function generateFlamegraphImages(
    traceId: string,
    profileJsonString: string,
    supabaseAdmin: SupabaseClient
): Promise<ImageGenerationResult> {
    const flamechartServerUrl = Deno.env.get('FLAMECHART_SERVER_URL');

    if (!flamechartServerUrl) {
        console.warn('FLAMECHART_SERVER_URL not configured, skipping image generation');
        return { lightImagePath: null, darkImagePath: null };
    }

    try {
        console.log(`Generating flamegraph images for trace ${traceId}...`);

        // Generate both light and dark mode images in parallel
        const [lightImageBuffer, darkImageBuffer] = await Promise.allSettled([
            generateSingleImage(profileJsonString, 'light', flamechartServerUrl),
            generateSingleImage(profileJsonString, 'dark', flamechartServerUrl)
        ]);

        // Upload successful images to storage
        const results: ImageGenerationResult = {
            lightImagePath: null,
            darkImagePath: null
        };

        // Prepare upload promises for successful generations
        const uploadPromises: Promise<{ type: 'light' | 'dark'; path: string }>[] = [];

        if (lightImageBuffer.status === 'fulfilled') {
            uploadPromises.push(
                uploadImageToStorage(supabaseAdmin, traceId, 'light', lightImageBuffer.value)
                    .then(path => ({ type: 'light' as const, path }))
            );
        } else {
            console.error('Failed to generate light mode image:', lightImageBuffer.reason);
        }

        if (darkImageBuffer.status === 'fulfilled') {
            uploadPromises.push(
                uploadImageToStorage(supabaseAdmin, traceId, 'dark', darkImageBuffer.value)
                    .then(path => ({ type: 'dark' as const, path }))
            );
        } else {
            console.error('Failed to generate dark mode image:', darkImageBuffer.reason);
        }

        // Upload all successful images in parallel
        if (uploadPromises.length > 0) {
            const uploadResults = await Promise.allSettled(uploadPromises);

            uploadResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const { type, path } = result.value;
                    if (type === 'light') {
                        results.lightImagePath = path;
                        console.log(`Light mode image uploaded: ${path}`);
                    } else {
                        results.darkImagePath = path;
                        console.log(`Dark mode image uploaded: ${path}`);
                    }
                } else {
                    console.error(`Failed to upload image:`, result.reason);
                }
            });
        }

        return results;

    } catch (error) {
        console.error('Image generation failed:', error);
        return { lightImagePath: null, darkImagePath: null };
    }
}

async function generateSingleImage(
    profileData: string,
    mode: 'light' | 'dark',
    serverUrl: string
): Promise<ArrayBuffer> {
    console.log(`Generating ${mode} mode image...`);

    const response = await fetch(`${serverUrl}/api/v1/render?mode=${mode}&width=1200&height=800`, {
        method: 'POST',
        headers: {
            // Required for the server to read the trace properly
            'Content-Type': 'text/plain',
            'Accept': 'image/png'
        },
        body: profileData
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Image generation failed for ${mode} mode: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`Generated ${mode} mode image: ${arrayBuffer.byteLength} bytes`);

    return arrayBuffer;
}

async function uploadImageToStorage(
    supabaseAdmin: SupabaseClient,
    traceId: string,
    mode: 'light' | 'dark',
    imageBuffer: ArrayBuffer
): Promise<string> {
    const fileName = `${traceId}/${mode}.png`;

    console.log(`Uploading ${mode} mode image: ${fileName}`);

    const { data, error } = await supabaseAdmin.storage
        .from('flamegraph-images')
        .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            cacheControl: 'public,max-age=31536000', // Cache for 1 year
            upsert: true // Allow overwriting if file exists
        });

    if (error) {
        throw new Error(`Image upload failed for ${mode} mode: ${error.message}`);
    }

    console.log(`Successfully uploaded ${mode} mode image: ${data.path}`);
    return `flamegraph-images/${data.path}`;
} 