export async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<{ file: File; blobUrl: string }> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                const file = new File([blob], 'profile-photo.jpg', {
                    type: 'image/jpeg',
                });
                resolve({ file, blobUrl });
            } else {
                reject(new Error('Canvas is empty or failed to convert to blob'));
            }
        }, 'image/jpeg');
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', reject);
        img.setAttribute('crossOrigin', 'anonymous'); // Prevent CORS errors
        img.src = url;
    });
}
