"use client";



import { useState } from "react";

import Image from "next/image";

import { Play, ZoomIn } from "lucide-react";

import { cn } from "@/lib/utils";



interface GalleryImage {

  url: string;

  altText?: string | null;

}



interface GalleryVideo {

  url: string;

  tag?: string | null;

}



interface ProductGalleryProps {

  images: GalleryImage[];

  videos?: GalleryVideo[];

  productName: string;

}



/** PDP gallery — uses original Excel product image URLs only */

export function ProductGallery({ images, videos = [], productName }: ProductGalleryProps) {

  const [activeIndex, setActiveIndex] = useState(0);

  const [showVideo, setShowVideo] = useState(false);



  const hasVideo = videos.length > 0;

  const activeImage = images[activeIndex];



  return (

    <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">

      {/* Thumbnails — vertical on desktop like standard ecommerce */}

      {(images.length > 1 || hasVideo) && (

        <div className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:w-20 lg:flex-col lg:overflow-visible">

          {images.map((img, i) => (

            <button

              key={img.url}

              type="button"

              onClick={() => {

                setShowVideo(false);

                setActiveIndex(i);

              }}

              className={cn(

                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white lg:h-[4.5rem] lg:w-full",

                !showVideo && activeIndex === i

                  ? "border-[#141414]"

                  : "border-[#ebe8e3] opacity-80 hover:opacity-100"

              )}

              aria-label={`View image ${i + 1}`}

            >

              <Image src={img.url} alt="" fill className="object-contain p-1" sizes="64px" />

            </button>

          ))}



          {hasVideo &&

            videos.map((video) => (

              <button

                key={video.url}

                type="button"

                onClick={() => setShowVideo(true)}

                className={cn(

                  "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 bg-[#faf9f7] lg:h-[4.5rem] lg:w-full",

                  showVideo ? "border-[#141414]" : "border-[#ebe8e3] opacity-80 hover:opacity-100"

                )}

                aria-label="Play product video"

              >

                <Play className="h-5 w-5 text-[#141414]" />

              </button>

            ))}

        </div>

      )}



      {/* Main image */}

      <div className="relative order-1 min-h-0 flex-1 lg:order-2">

        <div className="relative aspect-square overflow-hidden rounded-xl border border-[#ebe8e3] bg-white">

          {showVideo && hasVideo ? (

            <video

              src={videos[0].url}

              controls

              autoPlay

              className="h-full w-full object-contain"

              aria-label={`${productName} product video`}

            />

          ) : activeImage ? (

            <Image

              src={activeImage.url}

              alt={activeImage.altText || productName}

              fill

              className="object-contain p-6 md:p-8"

              sizes="(max-width: 768px) 100vw, 45vw"

              priority

            />

          ) : (

            <div className="flex h-full items-center justify-center text-[#9c9690]">

              No image available

            </div>

          )}



          {activeImage && !showVideo && images.length > 1 && (

            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#6b6560] shadow-sm backdrop-blur-sm">

              <ZoomIn className="h-3 w-3" />

              {activeIndex + 1} / {images.length}

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


