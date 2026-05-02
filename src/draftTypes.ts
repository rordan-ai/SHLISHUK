export type UploadedImage = {
  id: string
  name: string
  src: string
}

export type LandingDraft = {
  title: string
  logoImage: UploadedImage | null
  heroImage: UploadedImage | null
  secondaryImage: UploadedImage | null
  offerImages: UploadedImage[]
  socialLinks: {
    facebook: string
    instagram: string
  }
}
