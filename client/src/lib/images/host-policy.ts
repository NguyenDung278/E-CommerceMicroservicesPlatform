export const trustedImageHosts = [
  "127.0.0.1",
  "localhost",
  "lh3.googleusercontent.com",
  "placehold.co",
  "images.unsplash.com",
] as const;

export const nextImageRemotePatterns: Array<{
  protocol: "http" | "https";
  hostname: string;
}> = [
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "placehold.co",
  },
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
  {
    protocol: "http",
    hostname: "localhost",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
  },
];
