export interface SubmitReviewInput {
  orderItemId: string;
  rating: number;
  comment?: string;
}

export interface UploadedImageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/** Shows the reviewing buyer's contact name only — never their company name or buyerId. */
export interface PublicReview {
  id: string;
  buyerName: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  images: { id: string; url: string }[];
}

export interface ProductRatingSummary {
  avgRating: number | null;
  reviewCount: number;
}
