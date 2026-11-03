import GenericImage from "@/app/opengraph-image";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";

export const alt = `${SITE_NAME} — ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Override the parent profile's Journal image with the generic site artwork.
export default function Image() {
  return GenericImage();
}
