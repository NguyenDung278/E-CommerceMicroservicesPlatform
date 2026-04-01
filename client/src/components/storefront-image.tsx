import Image, { type ImageLoader, type ImageProps } from "next/image";

import { trustedImageHosts } from "@/lib/images/host-policy";

const trustedRemoteHosts = new Set<string>(trustedImageHosts);

const passthroughLoader: ImageLoader = ({ src }) => src;

function shouldBypassOptimization(src: string) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
    return true;
  }

  try {
    const url = new URL(src);
    return !trustedRemoteHosts.has(url.hostname);
  } catch {
    return false;
  }
}

type StorefrontImageProps = Omit<ImageProps, "alt" | "src"> & {
  alt: string;
  src: string;
};

export function StorefrontImage({
  src,
  alt,
  unoptimized,
  loader,
  ...props
}: StorefrontImageProps) {
  const passthrough = shouldBypassOptimization(src);

  return (
    <Image
      {...props}
      alt={alt}
      src={src}
      loader={passthrough ? passthroughLoader : loader}
      unoptimized={passthrough || unoptimized}
    />
  );
}
