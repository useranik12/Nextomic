import { z } from "zod";

/** WebP quality steps (percent) the person can pick for uploaded images. */
export const IMAGE_QUALITY_STEPS = [40, 50, 60, 70, 80] as const;
export type ImageQuality = (typeof IMAGE_QUALITY_STEPS)[number];

export const DEFAULT_IMAGE_QUALITY: ImageQuality = 60;

/** Quality of images uploaded outside a project, such as a profile image. Not a setting. */
export const BUILDER_IMAGE_QUALITY: ImageQuality = 60;

export const imageQualitySchema = z
  .union([z.literal(40), z.literal(50), z.literal(60), z.literal(70), z.literal(80)])
  .default(DEFAULT_IMAGE_QUALITY);

/** Project setting: images are shrunk to WebP in the browser before they are uploaded. */
export const imageCompressionSchema = z.object({
  enabled: z.boolean().default(true),
  quality: imageQualitySchema
});
export type ImageCompression = z.infer<typeof imageCompressionSchema>;

export const defaultImageCompression = (): ImageCompression => ({
  enabled: true,
  quality: DEFAULT_IMAGE_QUALITY
});
