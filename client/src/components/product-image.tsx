type ProductImageProps = {
  src?: string;
  alt: string;
};

export function ProductImage({ src, alt }: ProductImageProps) {
  if (!src) {
    return (
      <div className="product-image product-image--empty" aria-label={alt}>
        ND
      </div>
    );
  }

  return <img className="product-image" src={src} alt={alt} loading="lazy" />;
}
