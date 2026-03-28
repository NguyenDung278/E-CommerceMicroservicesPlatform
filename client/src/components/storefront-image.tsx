import Image, { type ImageLoader, type ImageProps } from "next/image";

const trustedRemoteHosts = new Set([
  "127.0.0.1",
  "localhost",
  "lh3.googleusercontent.com",
  "placehold.co",
]);

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
