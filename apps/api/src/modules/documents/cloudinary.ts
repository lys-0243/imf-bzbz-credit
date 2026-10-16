import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function configureCloudinary() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new BadRequestException(
      'Cloudinary non configuré (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)',
    );
  }
  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true,
  });
  configured = true;
}

export function cloudinaryFolder(dossierId: string) {
  const base = (process.env.CLOUDINARY_FOLDER || 'imf-bzbz').replace(
    /\/+$/,
    '',
  );
  return `${base}/dossiers/${dossierId}`;
}

export { cloudinary };
